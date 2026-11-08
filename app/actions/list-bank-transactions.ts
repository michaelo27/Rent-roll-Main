import { defineAction } from "@agent-native/core/action";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "List up to 300 imported bank rows with their current match status and associated unit label.",
  schema: z.object({ status: z.enum(["all", "matched", "suggested", "unplaced", "excluded"]).default("all").describe("Payment status filter"), limit: z.number().int().min(1).max(300).default(100).describe("Maximum rows to return") }),
  outputSchema: z.array(z.object({ id: z.string(), transactionDate: z.string(), description: z.string(), amountCents: z.number().int(), status: z.string(), unitId: z.string().nullable(), unitLabel: z.string().nullable(), matchReason: z.string(), importId: z.string() })),
  http: { method: "GET" },
  run: async ({ status, limit }) => {
    const db = getDb();
    const rows = status === "all"
      ? await db.select().from(schema.bankTransactions).orderBy(desc(schema.bankTransactions.createdAt)).limit(limit)
      : await db.select().from(schema.bankTransactions).where(eq(schema.bankTransactions.status, status)).orderBy(desc(schema.bankTransactions.createdAt)).limit(limit);
    const units = await db.select({ id: schema.rentUnits.id, unitLabel: schema.rentUnits.unitLabel }).from(schema.rentUnits);
    return rows.map((row) => ({ id: row.id, transactionDate: row.transactionDate, description: row.description, amountCents: row.amountCents, status: row.status, unitId: row.unitId, unitLabel: units.find((unit) => unit.id === row.unitId)?.unitLabel ?? null, matchReason: row.matchReason, importId: row.importId }));
  },
});
