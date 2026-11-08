import { defineAction } from "@agent-native/core/action";
import { and, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { getMonthRange, getTodayIsoDate } from "../shared/rent-roll.js";
import { getDb, schema } from "../server/db.js";

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const absolute = year! * 12 + monthNumber! - 1 + offset;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = absolute % 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export default defineAction({
  description: "Return unit-by-month rent payments for the selected month and the previous five months, using active payment allocations.",
  schema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).describe("Selected month in YYYY-MM format") }),
  outputSchema: z.object({ months: z.array(z.string()), units: z.array(z.object({ id: z.string(), property: z.string(), unitLabel: z.string(), tenantName: z.string(), tenantEmail: z.string(), notes: z.string(), rentCents: z.number().int(), dueDate: z.string(), leaseEnd: z.string(), cells: z.array(z.object({ month: z.string(), paidCents: z.number().int(), balanceCents: z.number().int(), status: z.enum(["Paid", "Part paid", "Late", "Upcoming", "Vacant"]) })) })) }),
  http: { method: "GET" },
  run: async ({ month }) => {
    const db = getDb();
    const months = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5));
    const start = getMonthRange(months[0]!).start;
    const end = getMonthRange(month).end;
    const [units, settings] = await Promise.all([
      db.select().from(schema.rentUnits).orderBy(schema.rentUnits.property, schema.rentUnits.unitLabel),
      db.select({ timezone: schema.rentSettings.timezone }).from(schema.rentSettings).limit(1),
    ]);
    const transactions = await db.select({ id: schema.bankTransactions.id, unitId: schema.bankTransactions.unitId, transactionDate: schema.bankTransactions.transactionDate })
      .from(schema.bankTransactions)
      .where(and(gte(schema.bankTransactions.transactionDate, start), lt(schema.bankTransactions.transactionDate, end)));
    const transactionDateById = new Map(transactions.map((transaction) => [transaction.id, transaction.transactionDate]));
    const activeAllocations = await db.select({ transactionId: schema.paymentAllocations.transactionId, unitId: schema.paymentAllocations.unitId, amountCents: schema.paymentAllocations.amountCents })
      .from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.undone, false));
    const paidByUnitMonth = new Map<string, number>();
    for (const allocation of activeAllocations) {
      const transactionDate = transactionDateById.get(allocation.transactionId);
      if (!transactionDate) continue;
      const key = `${allocation.unitId}:${transactionDate.slice(0, 7)}`;
      paidByUnitMonth.set(key, (paidByUnitMonth.get(key) ?? 0) + allocation.amountCents);
    }
    const today = getTodayIsoDate(settings[0]?.timezone ?? "America/Los_Angeles");
    return {
      months,
      units: units.map((unit) => ({
        id: unit.id,
        property: unit.property,
        unitLabel: unit.unitLabel,
        tenantName: unit.tenantName,
        tenantEmail: unit.tenantEmail,
        notes: unit.notes,
        rentCents: unit.rentCents,
        dueDate: unit.dueDate,
        leaseEnd: unit.leaseEnd,
        cells: months.map((value) => {
          const paidCents = paidByUnitMonth.get(`${unit.id}:${value}`) ?? 0;
          const isVacant = unit.tenantName.trim() === "";
          const balanceCents = isVacant ? 0 : Math.max(0, unit.rentCents - paidCents);
          const status: "Paid" | "Part paid" | "Late" | "Upcoming" | "Vacant" = isVacant ? "Vacant" : balanceCents === 0 ? "Paid" : paidCents > 0 ? "Part paid" : value < today.slice(0, 7) || (value === today.slice(0, 7) && unit.dueDate < today) ? "Late" : "Upcoming";
          return { month: value, paidCents, balanceCents, status };
        }),
      })),
    };
  },
});
