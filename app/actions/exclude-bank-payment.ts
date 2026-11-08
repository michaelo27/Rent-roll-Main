import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Mark an unplaced bank row as not rent so it is kept out of matching without changing any rent balance.",
  schema: z.object({ transactionId: z.string().describe("Bank transaction id") }),
  outputSchema: z.object({ id: z.string(), status: z.string() }),
  needsApproval: (_input, ctx) => ctx?.caller === "tool",
  run: async ({ transactionId }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [row] = await tx.update(schema.bankTransactions).set({ status: "excluded" }).where(eq(schema.bankTransactions.id, transactionId)).returning();
      if (!row) fail("That bank row could not be found.", { statusCode: 404, errorCode: "payment_not_found" });
      await tx.insert(schema.activityEntries).values({ id: crypto.randomUUID(), kind: "payment-excluded", description: "Bank payment marked as not rent", transactionId, createdAt: new Date().toISOString() });
      return { id: row.id, status: row.status };
    });
  },
});
