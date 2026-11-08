import { defineAction, fail } from "@agent-native/core/action";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";
import { extractRuleToken, rememberMatchRule } from "../server/match-rules.js";

export default defineAction({
  description: "Confirm a suggested bank payment for one unit, create its allocation and activity entry, and update its recorded paid total.",
  schema: z.object({ transactionId: z.string().uuid().or(z.string().min(1)).describe("Bank transaction id"), unitId: z.string().describe("Unit that received the payment"), reason: z.string().trim().min(1).max(240).describe("Plain-language reason for the match") }),
  outputSchema: z.object({ id: z.string(), unitId: z.string(), amountCents: z.number().int() }),
  needsApproval: (_input, ctx) => ctx?.caller === "tool",
  run: async ({ transactionId, unitId, reason }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [transaction] = await tx.select().from(schema.bankTransactions).where(eq(schema.bankTransactions.id, transactionId)).limit(1);
      if (!transaction || transaction.status === "excluded") return fail("This payment is no longer available to match.", { statusCode: 404, errorCode: "payment_not_found" });
      if (transaction.status === "matched") return fail("This payment has already been matched.", { statusCode: 409, errorCode: "payment_already_matched" });
      const [unit] = await tx.select().from(schema.rentUnits).where(eq(schema.rentUnits.id, unitId)).limit(1);
      if (!unit || !unit.tenantName.trim()) return fail("Choose an occupied unit to match this payment.", { statusCode: 404, errorCode: "unit_not_found" });
      const [allocation] = await tx.insert(schema.paymentAllocations).values({ id: crypto.randomUUID(), transactionId, unitId, amountCents: transaction.amountCents, createdAt: new Date().toISOString() }).returning();
      if (!allocation) return fail("Could not save this payment match.", { errorCode: "allocation_failed" });
      await tx.update(schema.bankTransactions).set({ status: "matched", unitId, matchReason: reason }).where(eq(schema.bankTransactions.id, transactionId));
      await tx.update(schema.rentUnits).set({ paidCents: sql`${schema.rentUnits.paidCents} + ${transaction.amountCents}` }).where(eq(schema.rentUnits.id, unitId));
      await tx.insert(schema.activityEntries).values({ id: crypto.randomUUID(), kind: "payment-matched", description: `Payment matched to ${unit.unitLabel}: ${reason}`, transactionId, createdAt: new Date().toISOString() });
      // Learn from this confirmation so the next import recognises the wording.
      const learnedToken = extractRuleToken(transaction.description, unit.unitLabel);
      if (learnedToken) {
        try {
          await rememberMatchRule(unitId, learnedToken);
        } catch {
          // Learning must never block or undo a confirmed payment.
        }
      }
      return { id: allocation.id, unitId, amountCents: transaction.amountCents };
    });
  },
});
