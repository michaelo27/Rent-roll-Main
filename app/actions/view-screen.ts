/**
 * See what the user is currently looking at on screen.
 *
 * Reads and returns the current navigation state from application state.
 *
 * Usage:
 *   pnpm action view-screen
 */

import { defineAction } from "@agent-native/core/action";
import { readAppStateForCurrentTab } from "@agent-native/core/application-state";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../server/db.js";
import { z } from "zod";

export default defineAction({
  description:
    "See what the user is currently looking at on screen. Returns the current navigation state for the app canvas plus agent rail. Always call this first before taking any action.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async () => {
    const navigation = await readAppStateForCurrentTab("navigation");
    if (!navigation) return "No application state found. Is the app running?";
    const screen: Record<string, unknown> = { navigation };
    const selectedUnitId = typeof navigation.selectedUnitId === "string" ? navigation.selectedUnitId : null;
    if (selectedUnitId) {
      const [unit] = await getDb().select().from(schema.rentUnits).where(eq(schema.rentUnits.id, selectedUnitId)).limit(1);
      if (unit) screen.selectedUnit = { id: unit.id, property: unit.property, unitLabel: unit.unitLabel, tenantName: unit.tenantName, rentCents: unit.rentCents, paidCents: unit.paidCents, dueDate: unit.dueDate, leaseEnd: unit.leaseEnd };
    }
    return screen;
  },
});
