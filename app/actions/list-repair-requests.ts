import { defineAction } from "@agent-native/core/action";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "List up to 100 tenant repair requests and their review status.",
  schema: z.object({}),
  outputSchema: z.array(z.object({ id: z.string(), tenantMessage: z.string(), category: z.string(), urgency: z.string(), suggestedReply: z.string(), status: z.string(), createdAt: z.string() })),
  http: { method: "GET" },
  run: async () => getDb().select().from(schema.repairRequests).orderBy(desc(schema.repairRequests.createdAt)).limit(100),
});
