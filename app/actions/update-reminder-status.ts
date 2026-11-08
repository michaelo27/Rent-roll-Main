import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Mark a saved reminder as sent or skipped; sending is always handled by the landlord outside the app.",
  schema: z.object({ id: z.string().describe("Reminder draft id"), status: z.enum(["sent", "skipped", "to-send"]).describe("New reminder status") }),
  outputSchema: z.object({ id: z.string(), status: z.string() }),
  run: async ({ id, status }) => {
    const [row] = await getDb().update(schema.reminderDrafts).set({ status }).where(eq(schema.reminderDrafts.id, id)).returning();
    if (!row) fail("That reminder could not be found.", { statusCode: 404, errorCode: "reminder_not_found" });
    return { id: row.id, status: row.status };
  },
});
