import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Undo one matched payment, reverse its unit paid total, and preserve the history entry as undone.",
  schema: z.object({ transactionId: z.string().describe("Matched transaction id to undo") }),
  outputSchema: z.object({ transactionId: z.string(), undone: z.boolean() }),
  needsApproval: (_input, ctx) => ctx?.caller === "tool",
  run: async ({ transactionId }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [transaction] = await tx.select().from(schema.bankTransactions).where(eq(schema.bankTransactions.id, transactionId)).limit(1);
      if (!transaction || transaction.status !== "matched" || !transaction.unitId) fail("This payment is no longer matched.", { statusCode: 409, errorCode: "payment_not_matched" });
      const [allocation] = await tx.select().from(schema.paymentAllocations).where(and(eq(schema.paymentAllocations.transactionId, transactionId), eq(schema.paymentAllocations.undone, false))).limit(1);
      if (!allocation || allocation.undone) fail("This payment has already been undone.", { statusCode: 409, errorCode: "payment_already_undone" });
      const [unit] = await tx.select().from(schema.rentUnits).where(eq(schema.rentUnits.id, allocation.unitId)).limit(1);
      if (!unit) fail("The unit for this payment no longer exists.", { statusCode: 404, errorCode: "unit_not_found" });
      await tx.update(schema.paymentAllocations).set({ undone: true }).where(eq(schema.paymentAllocations.id, allocation.id));
      await tx.update(schema.rentUnits).set({ paidCents: Math.max(0, unit.paidCents - allocation.amountCents) }).where(eq(schema.rentUnits.id, unit.id));
      await tx.update(schema.bankTransactions).set({ status: "suggested", unitId: null }).where(eq(schema.bankTransactions.id, transactionId));
      await tx.update(schema.activityEntries).set({ undone: true }).where(and(eq(schema.activityEntries.transactionId, transactionId), eq(schema.activityEntries.kind, "payment-matched"), eq(schema.activityEntries.undone, false)));
      await tx.insert(schema.activityEntries).values({ id: crypto.randomUUID(), kind: "payment-undone", description: `Payment match undone for ${unit.unitLabel}`, transactionId, createdAt: new Date().toISOString() });
      return { transactionId, undone: true };
    });
  },
});
