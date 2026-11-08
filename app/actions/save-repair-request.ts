import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Save a tenant repair message with its suggested category, urgency, and response; no message is sent.",
  schema: z.object({ tenantMessage: z.string().trim().min(1).max(3000).describe("Tenant's pasted repair request"), category: z.string().trim().min(1).max(100).describe("Repair category"), urgency: z.enum(["Urgent", "Soon", "Routine"]).describe("Urgency selected after review"), suggestedReply: z.string().max(2000).describe("Suggested response text") }),
  outputSchema: z.object({ id: z.string(), status: z.string() }),
  run: async ({ tenantMessage, category, urgency, suggestedReply }) => {
    const [row] = await getDb().insert(schema.repairRequests).values({ id: crypto.randomUUID(), tenantMessage, category, urgency, suggestedReply, status: "New", createdAt: new Date().toISOString() }).returning();
    if (!row) return fail("Could not save this repair request.", { errorCode: "repair_save_failed" });
    return { id: row.id, status: row.status };
  },
});
