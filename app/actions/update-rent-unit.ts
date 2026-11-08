import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { isValidIsoDate } from "../shared/rent-roll.js";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Update a unit's property, tenant, email, rent, due date, or lease end without removing its history.",
  schema: z.object({ id: z.string().describe("Rent unit id"), property: z.string().trim().min(1).max(120).optional().describe("Property name"), unitLabel: z.string().trim().min(1).max(40).optional().describe("Unit label"), tenantName: z.string().trim().max(120).optional().describe("Tenant name, or empty when vacant"), tenantEmail: z.string().email().or(z.literal("")).optional().describe("Tenant email address or empty"), notes: z.string().max(2000).optional().describe("Private unit note"), rentCents: z.number().int().positive().optional().describe("Monthly rent in integer cents"), dueDate: z.string().refine(isValidIsoDate).optional().describe("Due date in YYYY-MM-DD format"), leaseEnd: z.string().refine((value) => value === "" || isValidIsoDate(value)).optional().describe("Lease end in YYYY-MM-DD format, or empty when vacant") }),
  outputSchema: z.object({ id: z.string(), unitLabel: z.string(), tenantName: z.string(), rentCents: z.number().int(), leaseEnd: z.string() }),
  needsApproval: (_input, ctx) => ctx?.caller === "tool",
  run: async ({ id, ...patch }) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [current] = await tx.select().from(schema.rentUnits).where(eq(schema.rentUnits.id, id)).limit(1);
      if (!current) fail("That unit could not be found. Refresh the rent roll and try again.", { statusCode: 404, errorCode: "unit_not_found" });
      const property = patch.property ?? current.property;
      const unitLabel = patch.unitLabel ?? current.unitLabel;
      const [duplicate] = await tx.select({ id: schema.rentUnits.id }).from(schema.rentUnits).where(and(eq(schema.rentUnits.property, property), eq(schema.rentUnits.unitLabel, unitLabel), ne(schema.rentUnits.id, id))).limit(1);
      if (duplicate) fail("That unit label already exists at this property.", { statusCode: 409, errorCode: "unit_already_exists" });
      if (patch.leaseEnd && patch.leaseEnd !== current.leaseEnd) {
        await tx.insert(schema.leaseHistory).values({ id: crypto.randomUUID(), unitId: current.id, tenantName: current.tenantName, rentCents: current.rentCents, dueDate: current.dueDate, leaseEnd: current.leaseEnd, recordedAt: new Date().toISOString() });
      }
      const [row] = await tx.update(schema.rentUnits).set(patch).where(eq(schema.rentUnits.id, id)).returning();
      if (!row) return fail("That unit could not be updated.", { errorCode: "unit_update_failed" });
      return { id: row.id, unitLabel: row.unitLabel, tenantName: row.tenantName, rentCents: row.rentCents, leaseEnd: row.leaseEnd };
    });
  },
});
