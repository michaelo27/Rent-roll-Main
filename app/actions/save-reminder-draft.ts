import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Save or update a reminder draft for one unit; this does not send the message.",
  schema: z.object({ unitId: z.string().describe("Rent unit id"), stage: z.enum(["Friendly", "Firm", "Formal"]).describe("Reminder stage"), amountCents: z.number().int().nonnegative().describe("Still owed in integer cents"), daysLate: z.number().int().nonnegative().describe("Whole days after the due date"), message: z.string().min(1).max(4000).describe("Reminder text to save") }),
  outputSchema: z.object({ id: z.string(), unitId: z.string(), status: z.string() }),
  run: async ({ unitId, stage, amountCents, daysLate, message }) => {
    const db = getDb();
    const [existing] = await db.select().from(schema.reminderDrafts).where(and(eq(schema.reminderDrafts.unitId, unitId), eq(schema.reminderDrafts.stage, stage))).limit(1);
    const [row] = existing
      ? await db.update(schema.reminderDrafts).set({ amountCents, daysLate, message }).where(eq(schema.reminderDrafts.id, existing.id)).returning()
      : await db.insert(schema.reminderDrafts).values({ id: crypto.randomUUID(), unitId, stage, amountCents, daysLate, message, status: "to-send", createdAt: new Date().toISOString() }).returning();
    if (!row) return fail("Could not save this reminder draft.", { errorCode: "reminder_save_failed" });
    return { id: row.id, unitId: row.unitId, status: row.status };
  },
});
