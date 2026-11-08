import { defineAction } from "@agent-native/core/action";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "List the most recent 200 saved prior lease terms so ended leases remain available for review.",
  schema: z.object({}),
  outputSchema: z.array(z.object({ id: z.string(), unitId: z.string(), tenantName: z.string(), rentCents: z.number().int(), dueDate: z.string(), leaseEnd: z.string(), recordedAt: z.string() })),
  http: { method: "GET" },
  run: async () => getDb().select().from(schema.leaseHistory).orderBy(desc(schema.leaseHistory.recordedAt)).limit(200),
});
