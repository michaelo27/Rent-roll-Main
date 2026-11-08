import { defineAction } from "@agent-native/core/action";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "List up to 300 rent units with tenant, property, rent, paid total, due date, and lease end.",
  schema: z.object({ limit: z.number().int().min(1).max(300).default(100).describe("Maximum number of units") }),
  outputSchema: z.array(z.object({ id: z.string(), property: z.string(), unitLabel: z.string(), tenantName: z.string(), tenantEmail: z.string(), notes: z.string(), rentCents: z.number().int(), paidCents: z.number().int(), dueDate: z.string(), leaseEnd: z.string() })),
  http: { method: "GET" },
  run: async ({ limit }) => getDb().select().from(schema.rentUnits).orderBy(asc(schema.rentUnits.unitLabel)).limit(limit),
});
