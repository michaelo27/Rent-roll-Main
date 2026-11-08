import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Save rent reminder stages and templates, matching behavior, landlord details, timezone, currency, and schedule preference.",
  schema: z.object({ landlordName: z.string().trim().max(120).optional().describe("Landlord display name"), currencySymbol: z.string().min(1).max(4).optional().describe("Currency symbol"), dateFormat: z.string().min(1).max(40).optional().describe("Display date format"), timezone: z.string().min(1).max(80).optional().describe("IANA timezone name"), weekStart: z.enum(["Monday", "Sunday"]).optional().describe("First day of the week"), autoMatch: z.boolean().optional().describe("Automatically confirm only exact unit-reference and amount matches"), friendlyDays: z.number().int().min(1).max(90).optional().describe("Friendly reminder threshold days after due date"), firmDays: z.number().int().min(1).max(90).optional().describe("Firm reminder threshold days after due date"), formalDays: z.number().int().min(1).max(180).optional().describe("Formal reminder threshold days after due date"), friendlyTemplate: z.string().max(2000).optional().describe("Neutral friendly reminder template"), firmTemplate: z.string().max(2000).optional().describe("Neutral firm reminder template"), formalTemplate: z.string().max(2000).optional().describe("Neutral formal reminder template"), scheduleEnabled: z.boolean().optional().describe("Whether the Monday scheduled routine is enabled") }),
  outputSchema: z.object({ id: z.string(), landlordName: z.string(), currencySymbol: z.string(), timezone: z.string(), autoMatch: z.boolean(), scheduleEnabled: z.boolean() }),
  run: async (patch) => {
    const db = getDb();
    const [current] = await db.select().from(schema.rentSettings).where(eq(schema.rentSettings.id, "default")).limit(1);
    if (!current) return fail("Settings are not ready yet. Open Settings and try again.", { errorCode: "settings_not_found" });
    const friendlyDays = patch.friendlyDays ?? current.friendlyDays;
    const firmDays = patch.firmDays ?? current.firmDays;
    const formalDays = patch.formalDays ?? current.formalDays;
    if (firmDays < friendlyDays) return fail("The firm reminder must come after the friendly reminder.", { errorCode: "invalid_reminder_stages" });
    if (formalDays < firmDays) return fail("The formal reminder must come after the firm reminder.", { errorCode: "invalid_reminder_stages" });
    if (patch.timezone) {
      try { new Intl.DateTimeFormat("en-US", { timeZone: patch.timezone }).format(new Date()); }
      catch { return fail("Choose a valid timezone, such as America/Los_Angeles.", { errorCode: "invalid_timezone" }); }
    }
    const [row] = await db.update(schema.rentSettings).set(patch).where(eq(schema.rentSettings.id, "default")).returning();
    if (!row) return fail("Settings could not be saved. Try again.", { errorCode: "settings_save_failed" });
    return { id: row.id, landlordName: row.landlordName, currencySymbol: row.currencySymbol, timezone: row.timezone, autoMatch: row.autoMatch, scheduleEnabled: row.scheduleEnabled };
  },
});
