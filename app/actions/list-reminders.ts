import { defineAction } from "@agent-native/core/action";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { formatCents, getDaysLate, renderReminderTemplate } from "../shared/rent-roll.js";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "List late units with a neutral reminder draft at the configured stage; it never sends a message.",
  schema: z.object({}),
  outputSchema: z.array(z.object({ id: z.string(), unitId: z.string(), tenantName: z.string(), tenantEmail: z.string(), unitLabel: z.string(), stage: z.string(), amountCents: z.number().int(), daysLate: z.number().int(), message: z.string(), status: z.string() })),
  http: { method: "GET" },
  run: async () => {
    const db = getDb();
    const [units, settingsRows, drafts] = await Promise.all([
      db.select().from(schema.rentUnits).orderBy(asc(schema.rentUnits.unitLabel)),
      db.select().from(schema.rentSettings).where(eq(schema.rentSettings.id, "default")).limit(1),
      db.select().from(schema.reminderDrafts),
    ]);
    const settings = settingsRows[0];
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: settings?.timezone || "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const today = `${date.year}-${date.month}-${date.day}`;
    return units.flatMap((unit) => {
      const amountCents = unit.rentCents - unit.paidCents;
      const daysLate = getDaysLate(unit.dueDate, today);
      if (!unit.tenantName.trim() || amountCents <= 0 || daysLate < (settings?.friendlyDays ?? 3)) return [];
      const stage = daysLate >= (settings?.formalDays ?? 14) ? "Formal" : daysLate >= (settings?.firmDays ?? 7) ? "Firm" : "Friendly";
      const existing = drafts.find((draft) => draft.unitId === unit.id && draft.stage === stage);
      const template = stage === "Formal" ? settings?.formalTemplate : stage === "Firm" ? settings?.firmTemplate : settings?.friendlyTemplate;
      const message = existing?.message ?? renderReminderTemplate(template ?? "Hi {tenantName}, {amount} is still due for {unit}. Please reply with an update. {landlordName}", {
        tenantName: unit.tenantName, unit: unit.unitLabel, amount: formatCents(amountCents, settings?.currencySymbol), dueDate: unit.dueDate, daysLate: String(daysLate), landlordName: settings?.landlordName ?? "",
      });
      return [{ id: existing?.id ?? "", unitId: unit.id, tenantName: unit.tenantName, tenantEmail: unit.tenantEmail, unitLabel: unit.unitLabel, stage, amountCents, daysLate, message, status: existing?.status ?? "to-send" }];
    });
  },
});
