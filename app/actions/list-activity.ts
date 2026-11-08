import { defineAction } from "@agent-native/core/action";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "List the latest 10 payment and import activity entries, including whether each was undone.",
  schema: z.object({}),
  outputSchema: z.array(z.object({ id: z.string(), kind: z.string(), description: z.string(), transactionId: z.string().nullable(), createdAt: z.string(), undone: z.boolean() })),
  http: { method: "GET" },
  run: async () => getDb().select().from(schema.activityEntries).orderBy(desc(schema.activityEntries.createdAt)).limit(10),
});
