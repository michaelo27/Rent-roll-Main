import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Change a repair request status to New, Scheduled, or Done.",
  schema: z.object({ id: z.string().describe("Repair request id"), status: z.enum(["New", "Scheduled", "Done"]).describe("Updated repair status") }),
  outputSchema: z.object({ id: z.string(), status: z.string() }),
  run: async ({ id, status }) => {
    const [row] = await getDb().update(schema.repairRequests).set({ status }).where(eq(schema.repairRequests.id, id)).returning();
    if (!row) fail("That repair request could not be found.", { statusCode: 404, errorCode: "repair_not_found" });
    return { id: row.id, status: row.status };
  },
});
