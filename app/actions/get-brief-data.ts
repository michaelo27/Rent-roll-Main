import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { and, eq, gte, lt } from "drizzle-orm";
import { getDaysLate, getMonthRange } from "../shared/rent-roll.js";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "Return calculated rent totals, unpaid units, upcoming leases, and the saved Monday note for the current date.",
  schema: z.object({}),
  outputSchema: z.object({
    expectedCents: z.number().int(),
    collectedCents: z.number().int(),
    stillOwedCents: z.number().int(),
    paidCount: z.number().int(),
    unitCount: z.number().int(),
    lateUnits: z.array(z.object({ id: z.string(), unitLabel: z.string(), tenantName: z.string(), balanceCents: z.number().int(), daysLate: z.number().int() })),
    endingLeases: z.array(z.object({ id: z.string(), unitLabel: z.string(), tenantName: z.string(), leaseEnd: z.string() })),
    weeklyNote: z.string(),
    lastPreparedAt: z.string(),
  }),
  http: { method: "GET" },
  run: async () => {
    const db = getDb();
    const [units, settings] = await Promise.all([
      db.select().from(schema.rentUnits),
      db.select().from(schema.rentSettings).limit(1),
    ]);
    const prefs = settings[0];
    const dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: prefs?.timezone || "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const dateValue = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
    const today = `${dateValue.year}-${dateValue.month}-${dateValue.day}`;
    const currentMonth = today.slice(0, 7);
    const { start, end } = getMonthRange(currentMonth);
    const transactions = await db.select({ id: schema.bankTransactions.id, unitId: schema.bankTransactions.unitId, transactionDate: schema.bankTransactions.transactionDate })
      .from(schema.bankTransactions)
      .where(and(gte(schema.bankTransactions.transactionDate, start), lt(schema.bankTransactions.transactionDate, end)));
    const transactionDates = new Map(transactions.map((transaction) => [transaction.id, transaction.transactionDate]));
    const allocations = await db.select({ transactionId: schema.paymentAllocations.transactionId, unitId: schema.paymentAllocations.unitId, amountCents: schema.paymentAllocations.amountCents })
      .from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.undone, false));
    const paidByUnit = new Map<string, number>();
    for (const allocation of allocations) {
      if (!transactionDates.has(allocation.transactionId)) continue;
      paidByUnit.set(allocation.unitId, (paidByUnit.get(allocation.unitId) ?? 0) + allocation.amountCents);
    }
    const occupiedUnits = units.filter((unit) => unit.tenantName.trim() !== "");
    const expectedCents = occupiedUnits.reduce((sum, unit) => sum + unit.rentCents, 0);
    const collectedCents = [...paidByUnit.values()].reduce((sum, amount) => sum + amount, 0);
    const lateUnits = occupiedUnits
      .filter((unit) => unit.rentCents > (paidByUnit.get(unit.id) ?? 0) && unit.dueDate < today)
      .map((unit) => ({
        id: unit.id,
        unitLabel: unit.unitLabel,
        tenantName: unit.tenantName,
        balanceCents: Math.max(0, unit.rentCents - (paidByUnit.get(unit.id) ?? 0)),
        daysLate: getDaysLate(unit.dueDate, today),
      }));
    const in45Days = new Date(`${today}T00:00:00Z`);
    in45Days.setUTCDate(in45Days.getUTCDate() + 45);
    const endDate = in45Days.toISOString().slice(0, 10);
    const endingLeases = units
      .filter((unit) => unit.leaseEnd >= today && unit.leaseEnd <= endDate)
      .map((unit) => ({ id: unit.id, unitLabel: unit.unitLabel, tenantName: unit.tenantName, leaseEnd: unit.leaseEnd }));
    return {
      expectedCents,
      collectedCents,
      stillOwedCents: occupiedUnits.reduce((sum, unit) => sum + Math.max(0, unit.rentCents - (paidByUnit.get(unit.id) ?? 0)), 0),
      paidCount: occupiedUnits.filter((unit) => (paidByUnit.get(unit.id) ?? 0) >= unit.rentCents).length,
      unitCount: occupiedUnits.length,
      lateUnits,
      endingLeases,
      weeklyNote: prefs?.weeklyNote ?? "",
      lastPreparedAt: prefs?.lastPreparedAt ?? "",
    };
  },
});
