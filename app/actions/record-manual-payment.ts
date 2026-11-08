import { defineAction, fail } from "@agent-native/core/action";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Record a payment for a specific unit, create its allocation and activity entry, and update the paid total atomically.",
  schema: z.object({ unitId: z.string().describe("Rent unit id receiving this payment"), transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Payment date in YYYY-MM-DD format"), amountCents: z.number().int().positive().describe("Payment amount in integer cents"), description: z.string().trim().min(1).max(500).describe("Payment reference or manual note") }),
  outputSchema: z.object({ transactionId: z.string(), allocationId: z.string(), amountCents: z.number().int() }),
  needsApproval: (_input, ctx) => ctx?.caller === "tool",
  run: async ({ unitId, transactionDate, amountCents, description }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [unit] = await tx.select().from(schema.rentUnits).where(eq(schema.rentUnits.id, unitId)).limit(1);
      if (!unit || !unit.tenantName.trim()) return fail("Choose an occupied unit to record this payment.", { statusCode: 404, errorCode: "unit_not_found" });
      const now = new Date().toISOString();
      const importId = crypto.randomUUID();
      const transactionId = crypto.randomUUID();
      const allocationId = crypto.randomUUID();
      await tx.insert(schema.bankImports).values({ id: importId, bankName: "Manual entry", importedAt: now, rowCount: 1, skippedCount: 0 });
      await tx.insert(schema.bankTransactions).values({ id: transactionId, importId, transactionDate, description, amountCents, fingerprint: `manual-${transactionId}`, status: "matched", unitId, matchReason: `Assigned to ${unit.unitLabel} by landlord`, createdAt: now });
      await tx.insert(schema.paymentAllocations).values({ id: allocationId, transactionId, unitId, amountCents, createdAt: now });
      await tx.update(schema.rentUnits).set({ paidCents: sql`${schema.rentUnits.paidCents} + ${amountCents}` }).where(eq(schema.rentUnits.id, unitId));
      await tx.insert(schema.activityEntries).values({ id: crypto.randomUUID(), kind: "payment-recorded", description: `Payment recorded for ${unit.unitLabel}`, transactionId, createdAt: now });
      return { transactionId, allocationId, amountCents };
    });
  },
});
