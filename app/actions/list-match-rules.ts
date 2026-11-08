import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";
import { readMatchRules } from "../server/match-rules.js";

export default defineAction({
  description: "List the payment wordings Rent Roll has learned from your confirmed matches, with the unit each one belongs to.",
  schema: z.object({}),
  outputSchema: z.array(z.object({
    unitId: z.string(),
    unitLabel: z.string(),
    tenantName: z.string(),
    pattern: z.string(),
    useCount: z.number().int(),
  })),
  http: { method: "GET" },
  run: async () => {
    const db = getDb();
    const [rules, units] = await Promise.all([
      readMatchRules(),
      db.select({ id: schema.rentUnits.id, unitLabel: schema.rentUnits.unitLabel, tenantName: schema.rentUnits.tenantName }).from(schema.rentUnits),
    ]);
    return rules.map((rule) => ({
      unitId: rule.unitId,
      unitLabel: units.find((unit) => unit.id === rule.unitId)?.unitLabel ?? "",
      tenantName: units.find((unit) => unit.id === rule.unitId)?.tenantName ?? "",
      pattern: rule.pattern,
      useCount: rule.useCount,
    }));
  },
});
