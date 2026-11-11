import { defineAction, fail } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { isValidIsoDate } from "../shared/rent-roll.js";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description:
    "Add a unit, tenant, rent amount, due date, and lease end to the rent roll.",
  schema: z.object({
    property: z.string().trim().min(1).max(120).describe("Property name"),
    unitLabel: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .describe("Unit label such as 2A"),
    tenantName: z
      .string()
      .trim()
      .max(120)
      .default("")
      .describe("Tenant full name, or empty for a vacant unit"),
    tenantEmail: z
      .string()
      .email()
      .or(z.literal(""))
      .default("")
      .describe("Tenant email address, or empty"),
    rentCents: z
      .number()
      .int()
      .positive()
      .describe("Monthly rent in integer cents"),
    dueDate: z
      .string()
      .refine(isValidIsoDate)
      .describe("Rent due date in YYYY-MM-DD format"),
    leaseEnd: z
      .string()
      .refine((value) => value === "" || isValidIsoDate(value))
      .default("")
      .describe(
        "Lease end date in YYYY-MM-DD format, or empty for a vacant unit",
      ),
  }),
  outputSchema: z.object({
    id: z.string(),
    property: z.string(),
    unitLabel: z.string(),
    tenantName: z.string(),
  }),
  run: async (input) => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: schema.rentUnits.id })
        .from(schema.rentUnits)
        .where(
          and(
            eq(schema.rentUnits.property, input.property),
            eq(schema.rentUnits.unitLabel, input.unitLabel),
          ),
        )
        .limit(1);
      if (existing)
        fail("That unit label already exists at this property.", {
          statusCode: 409,
          errorCode: "unit_already_exists",
        });
      const [row] = await tx
        .insert(schema.rentUnits)
        .values({ id: crypto.randomUUID(), ...input, paidCents: 0 })
        .returning();
      if (!row)
        return fail("Could not add this unit. Try again.", {
          errorCode: "unit_create_failed",
        });
      return {
        id: row.id,
        property: row.property,
        unitLabel: row.unitLabel,
        tenantName: row.tenantName,
      };
    });
  },
});
