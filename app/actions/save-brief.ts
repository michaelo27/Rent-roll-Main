import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Save a short assistant-written weekly note and its preparation timestamp after reviewing the deterministic brief data.",
  schema: z.object({ note: z.string().trim().min(1).max(1200).describe("Two or three plain-language sentences; do not calculate or restate balances"), preparedAt: z.string().datetime().describe("Preparation timestamp in ISO 8601 UTC format") }),
  outputSchema: z.object({ saved: z.boolean(), preparedAt: z.string() }),
  run: async ({ note, preparedAt }) => {
    const [row] = await getDb().update(schema.rentSettings).set({ weeklyNote: note, lastPreparedAt: preparedAt }).where(eq(schema.rentSettings.id, "default")).returning();
    if (!row) return fail("The weekly note could not be saved. Try again.", { errorCode: "brief_save_failed" });
    return { saved: true, preparedAt: row.lastPreparedAt };
  },
});
