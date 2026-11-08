import { defineAction, fail } from "@agent-native/core/action";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

// Mirrors the defaults the app writes on first read in get-rent-settings, so a
// reset leaves one usable settings row behind instead of none.
const DEFAULT_TEMPLATES = {
  friendlyTemplate: "Hi {tenantName}, just a friendly note that {amount} for {unit} was due on {dueDate}. Please let me know if you have already sent it. Thank you, {landlordName}",
  firmTemplate: "Hi {tenantName}, {amount} for {unit} is still outstanding, {daysLate} days after the due date. Please reply with an update when you can. Thank you, {landlordName}",
  formalTemplate: "Hi {tenantName}, our records show {amount} remains due for {unit}, originally due {dueDate}. Please contact me to discuss next steps. {landlordName}",
};

export default defineAction({
  description: "Erase every unit, payment, reminder, repair request, lease record, statement import, learned match rule, and saved preference, returning the workspace to a brand-new empty state. Use only when the user asks for a fresh start.",
  schema: z.object({}),
  outputSchema: z.object({ cleared: z.boolean(), unitsRemoved: z.number().int(), paymentsRemoved: z.number().int() }),
  // A button pressing this is a deliberate click. The assistant is not allowed
  // to wipe the workspace on its own.
  needsApproval: (_input, ctx) => ctx?.caller === "tool",
  run: async () => {
    // AUTH_DISABLED is the demo switch. With real sign-in on, this action
    // refuses, so a deployed owner workspace can never be wiped by a visitor.
    const demoMode = ["1", "true"].includes((process.env.AUTH_DISABLED ?? "").trim().toLowerCase());
    if (!demoMode) return fail("Reset is only available in demo mode.", { statusCode: 403, errorCode: "reset_disabled" });
    const db = getDb();
    return db.transaction(async (tx) => {
      // Children before parents, so no row is left pointing at a deleted one.
      await tx.delete(schema.paymentAllocations);
      await tx.delete(schema.activityEntries);
      await tx.delete(schema.reminderDrafts);
      await tx.delete(schema.leaseHistory);
      const payments = await tx.delete(schema.bankTransactions).returning({ id: schema.bankTransactions.id });
      await tx.delete(schema.bankImports);
      await tx.delete(schema.repairRequests);
      const units = await tx.delete(schema.rentUnits).returning({ id: schema.rentUnits.id });
      await tx.delete(schema.rentSettings);
      await tx.insert(schema.rentSettings).values({ id: "default", ...DEFAULT_TEMPLATES });
      // Learned match rules live in their own table, created on first use.
      await tx.execute(sql`DO $$ BEGIN IF to_regclass('match_rules') IS NOT NULL THEN DELETE FROM match_rules; END IF; END $$`);
      return { cleared: true, unitsRemoved: units.length, paymentsRemoved: payments.length };
    });
  },
});
