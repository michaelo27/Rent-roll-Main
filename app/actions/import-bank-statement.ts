import { defineAction, fail } from "@agent-native/core/action";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { findMatchCandidate, isValidIsoDate } from "../shared/rent-roll.js";
import { getDb, schema } from "../server/db.js";
import { readMatchRules } from "../server/match-rules.js";

const rowSchema = z.object({
  date: z.string().refine(isValidIsoDate).describe("Transaction date in YYYY-MM-DD format"),
  description: z.string().min(1).max(500).describe("Bank transaction description"),
  amountCents: z.number().int().positive().describe("Money-in amount in integer cents"),
});

export default defineAction({
  description: "Import positive bank transactions, skip duplicates, and automatically match only a unique unit-reference plus exact amount.",
  schema: z.object({
    bankName: z.string().trim().min(1).max(100).default("Bank statement").describe("Bank or account label"),
    rows: z.array(rowSchema).min(1).max(500).describe("Parsed bank rows with ISO date, description, and positive amount in cents"),
  }),
  outputSchema: z.object({ importId: z.string(), importedCount: z.number().int(), skippedCount: z.number().int(), autoMatchedCount: z.number().int(), suggestedCount: z.number().int(), unplacedCount: z.number().int() }),
  run: async ({ bankName, rows }) => {
    const db = getDb();
    const now = new Date().toISOString();
    const matchRules = await readMatchRules().catch(() => [] as Array<{ unitId: string; pattern: string; useCount: number }>);
    return db.transaction(async (tx) => {
      const normalized = rows.map((row) => ({
        row,
        fingerprint: `${row.date}|${row.description.trim().toLowerCase()}|${row.amountCents}`,
      }));
      const fingerprints = [...new Set(normalized.map((item) => item.fingerprint))];
      const existing = await tx.select({ fingerprint: schema.bankTransactions.fingerprint, transactionDate: schema.bankTransactions.transactionDate, description: schema.bankTransactions.description, amountCents: schema.bankTransactions.amountCents }).from(schema.bankTransactions).limit(2000);
      const existingSet = new Set(existing.flatMap((row) => [row.fingerprint, `${row.transactionDate}|${row.description.trim().toLowerCase()}|${row.amountCents}`]));
      const freshRows = normalized.filter((item) => {
        if (existingSet.has(item.fingerprint)) return false;
        existingSet.add(item.fingerprint);
        return true;
      });
      const [importRow] = await tx.insert(schema.bankImports).values({
        id: crypto.randomUUID(), bankName, importedAt: now, rowCount: rows.length, skippedCount: rows.length - freshRows.length,
      }).returning();
      if (!importRow) return fail("Could not save this statement import.", { errorCode: "import_create_failed" });
      const [units, settingRows] = await Promise.all([
        tx.select().from(schema.rentUnits),
        tx.select({ autoMatch: schema.rentSettings.autoMatch }).from(schema.rentSettings).limit(1),
      ]);
      const autoMatchEnabled = settingRows[0]?.autoMatch ?? true;
      let autoMatchedCount = 0;
      let suggestedCount = 0;
      let unplacedCount = 0;
      const paidByUnit = new Map<string, number>();
      for (const item of freshRows) {
        const { row, fingerprint } = item;
        const currentUnits = units.map((unit) => ({ ...unit, paidCents: unit.paidCents + (paidByUnit.get(unit.id) ?? 0) }));
        const candidate = findMatchCandidate(row.description, row.amountCents, currentUnits, matchRules);
        const status = candidate?.automatic && autoMatchEnabled ? "matched" : candidate ? "suggested" : "unplaced";
        const [transaction] = await tx.insert(schema.bankTransactions).values({
          id: crypto.randomUUID(), importId: importRow.id, transactionDate: row.date,
          description: row.description.trim(), amountCents: row.amountCents, fingerprint,
          status, unitId: candidate?.unitId ?? null, matchReason: candidate?.reason ?? "No clear unit reference or amount match", createdAt: now,
        }).returning();
        if (!transaction) return fail("Could not save a statement row.", { errorCode: "transaction_create_failed" });
        if (!candidate) { unplacedCount += 1; continue; }
        if (!candidate.automatic || !autoMatchEnabled) { suggestedCount += 1; continue; }
        autoMatchedCount += 1;
        paidByUnit.set(candidate.unitId, (paidByUnit.get(candidate.unitId) ?? 0) + row.amountCents);
        await tx.insert(schema.paymentAllocations).values({ id: crypto.randomUUID(), transactionId: transaction.id, unitId: candidate.unitId, amountCents: row.amountCents, createdAt: now });
        const unit = units.find((item) => item.id === candidate.unitId);
        await tx.insert(schema.activityEntries).values({ id: crypto.randomUUID(), kind: "payment-matched", description: `Payment matched to ${unit?.unitLabel ?? "unit"}: ${candidate.reason}`, transactionId: transaction.id, createdAt: now });
      }
      for (const [unitId, amountCents] of paidByUnit) {
        await tx.update(schema.rentUnits).set({ paidCents: sql`${schema.rentUnits.paidCents} + ${amountCents}` }).where(sql`${schema.rentUnits.id} = ${unitId}`);
      }
      return { importId: importRow.id, importedCount: freshRows.length, skippedCount: rows.length - freshRows.length, autoMatchedCount, suggestedCount, unplacedCount };
    });
  },
});
