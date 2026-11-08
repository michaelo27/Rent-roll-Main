import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Read reminder templates, match preferences, locale settings, and weekly schedule preference.",
  schema: z.object({}),
  outputSchema: z.object({ id: z.string(), landlordName: z.string(), currencySymbol: z.string(), dateFormat: z.string(), timezone: z.string(), weekStart: z.string(), autoMatch: z.boolean(), friendlyDays: z.number().int(), firmDays: z.number().int(), formalDays: z.number().int(), friendlyTemplate: z.string(), firmTemplate: z.string(), formalTemplate: z.string(), scheduleEnabled: z.boolean(), weeklyNote: z.string(), lastPreparedAt: z.string() }),
  http: { method: "GET" },
  run: async () => {
    const db = getDb();
    const [saved] = await db.select().from(schema.rentSettings).where(eq(schema.rentSettings.id, "default")).limit(1);
    if (saved) return saved;
    const [created] = await db.insert(schema.rentSettings).values({ id: "default", friendlyTemplate: "Hi {tenantName}, just a friendly note that {amount} for {unit} was due on {dueDate}. Please let me know if you have already sent it. Thank you, {landlordName}", firmTemplate: "Hi {tenantName}, {amount} for {unit} is still outstanding, {daysLate} days after the due date. Please reply with an update when you can. Thank you, {landlordName}", formalTemplate: "Hi {tenantName}, our records show {amount} remains due for {unit}, originally due {dueDate}. Please contact me to discuss next steps. {landlordName}" }).returning();
    if (!created) return fail("Could not load rent settings. Try again.", { errorCode: "settings_load_failed" });
    return created;
  },
});
