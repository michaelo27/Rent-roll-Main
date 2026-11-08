import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

type Confidence = "high" | "medium" | "low";

type Candidate = {
  unitId: string;
  unitLabel: string;
  tenantName: string;
  outstandingCents: number;
  reason: string;
  confidence: Confidence;
};

function normalize(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function scoreCandidates(
  transaction: { description: string; amountCents: number },
  units: Array<{
    id: string;
    unitLabel: string;
    tenantName: string;
    rentCents: number;
    paidCents: number;
  }>,
): Candidate[] {
  const description = normalize(transaction.description);
  const amount = transaction.amountCents;
  const candidates: Candidate[] = [];

  for (const unit of units) {
    if (!unit.tenantName.trim()) continue;
    const outstanding = Math.max(0, unit.rentCents - unit.paidCents);
    const label = normalize(unit.unitLabel);
    const reference = label.length > 0 && description.includes(label);

    if (reference) {
      const exact =
        amount === outstanding ||
        (unit.paidCents === 0 && amount === unit.rentCents);
      candidates.push({
        unitId: unit.id,
        unitLabel: unit.unitLabel,
        tenantName: unit.tenantName,
        outstandingCents: outstanding,
        reason: exact
          ? `Payment reference names ${unit.unitLabel} and the amount matches what is outstanding`
          : `Payment reference names ${unit.unitLabel}, but the amount does not match what is outstanding`,
        confidence: exact ? "high" : "medium",
      });
      continue;
    }

    if (outstanding > 0 && amount === outstanding) {
      candidates.push({
        unitId: unit.id,
        unitLabel: unit.unitLabel,
        tenantName: unit.tenantName,
        outstandingCents: outstanding,
        reason: `Amount matches exactly what ${unit.unitLabel} still owes; the payment reference is unclear`,
        confidence: "medium",
      });
      continue;
    }

    // A part payment only counts as a lead when it is a meaningful slice of the rent,
    // so an unrelated amount does not crowd the list with noise.
    if (
      amount > 0 &&
      outstanding > 0 &&
      amount < outstanding &&
      amount >= unit.rentCents * 0.1
    ) {
      candidates.push({
        unitId: unit.id,
        unitLabel: unit.unitLabel,
        tenantName: unit.tenantName,
        outstandingCents: outstanding,
        reason: `Amount is less than what ${unit.unitLabel} owes, so this may be a part payment`,
        confidence: "low",
      });
    }
  }

  const rank: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
  return candidates
    .sort((left, right) => rank[left.confidence] - rank[right.confidence])
    .slice(0, 3);
}

export default defineAction({
  description:
    "Read unplaced bank payments and return ranked candidate units for each one, with a plain-language reason and a confidence of high, medium, or low. This action never changes anything; confirming a match is a separate step the landlord must approve.",
  schema: z.object({
    transactionId: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Optional single bank payment to review instead of every unplaced payment",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .describe("Maximum unplaced payments to review at once"),
  }),
  outputSchema: z.object({
    reviewedCount: z.number().int(),
    proposals: z.array(
      z.object({
        transactionId: z.string(),
        transactionDate: z.string(),
        description: z.string(),
        amountCents: z.number().int(),
        candidates: z.array(
          z.object({
            unitId: z.string(),
            unitLabel: z.string(),
            tenantName: z.string(),
            outstandingCents: z.number().int(),
            reason: z.string(),
            confidence: z.enum(["high", "medium", "low"]),
          }),
        ),
        note: z.string(),
      }),
    ),
  }),
  run: async ({ transactionId, limit }) => {
    const db = getDb();
    const rows = transactionId
      ? await db
          .select()
          .from(schema.bankTransactions)
          .where(eq(schema.bankTransactions.id, transactionId))
          .limit(limit)
      : await db
          .select()
          .from(schema.bankTransactions)
          .where(eq(schema.bankTransactions.status, "unplaced"))
          .limit(limit);

    const units = await db
      .select({
        id: schema.rentUnits.id,
        unitLabel: schema.rentUnits.unitLabel,
        tenantName: schema.rentUnits.tenantName,
        rentCents: schema.rentUnits.rentCents,
        paidCents: schema.rentUnits.paidCents,
      })
      .from(schema.rentUnits);

    const proposals = rows.map((row: (typeof rows)[number]) => {
      const candidates = scoreCandidates(row, units);
      return {
        transactionId: row.id,
        transactionDate: row.transactionDate,
        description: row.description,
        amountCents: row.amountCents,
        candidates,
        note: candidates.length
          ? "Ask the landlord before confirming any of these."
          : "No unit matches this payment by reference or amount. Ask the landlord who sent it, or mark it as not rent.",
      };
    });

    return { reviewedCount: proposals.length, proposals };
  },
});
