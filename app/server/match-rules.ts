import { sql } from "drizzle-orm";
import { getDb } from "./db.js";

/**
 * Learned matching rules. When the landlord confirms a payment for a unit, the
 * most distinctive word in that payment's description is remembered against
 * that unit. Future imports recognise it the same way they recognise a unit
 * label, so the app gets better instead of asking the same question again.
 * The table is created on first use, so no migration is required.
 */

export type MatchRule = { unitId: string; pattern: string; useCount: number };

/** Words that appear on almost every bank row and identify nobody. */
const STOPWORDS = new Set([
  "RENT", "RENTAL", "PAYMENT", "PAY", "PAID", "TRANSFER", "TRF", "POS", "NIP",
  "MOBILE", "ONLINE", "BANK", "CASH", "DEPOSIT", "CREDIT", "DEBIT", "FROM",
  "TO", "THE", "AND", "FOR", "YOUR", "WITH", "THIS", "THAT", "INTO", "OUT",
  "BALANCE", "FEE", "CHARGE", "VAT", "STAMP", "SMS", "ALERT", "WEB", "APP",
  "USSD", "ATM", "CARD", "ACCOUNT", "ACCT", "NIGERIA", "LIMITED", "LTD",
]);

function tokensOf(value: string): string[] {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Pick the word most likely to identify this payer: long enough to be a name,
 * not a banking word, not the unit label itself, and not purely numeric.
 */
export function extractRuleToken(description: string, unitLabel: string): string | null {
  const label = unitLabel.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const candidates = tokensOf(description).filter(
    (token) => token.length >= 3 && !STOPWORDS.has(token) && token !== label && !/^\d+$/.test(token),
  );
  if (!candidates.length) return null;
  return candidates.sort((left, right) => right.length - left.length)[0] ?? null;
}

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const db = getDb();
      await db.execute(sql`CREATE TABLE IF NOT EXISTS match_rules (
        id text PRIMARY KEY,
        unit_id text NOT NULL,
        pattern text NOT NULL,
        use_count integer NOT NULL DEFAULT 1,
        created_at text NOT NULL,
        updated_at text NOT NULL
      )`);
      await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS match_rules_unit_pattern_idx ON match_rules (unit_id, pattern)`,
      );
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const rows = (result as { rows?: unknown })?.rows;
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

export async function readMatchRules(): Promise<MatchRule[]> {
  await ensureTable();
  const result = await getDb().execute(sql`SELECT unit_id, pattern, use_count FROM match_rules`);
  return rowsOf(result).map((row) => ({
    unitId: String(row.unit_id ?? row.unitid ?? ""),
    pattern: String(row.pattern ?? ""),
    useCount: Number(row.use_count ?? row.usecount ?? 1),
  }));
}

/** Remember the pattern for this unit. A pattern belongs to one unit only. */
export async function rememberMatchRule(unitId: string, pattern: string): Promise<void> {
  await ensureTable();
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute(sql`DELETE FROM match_rules WHERE pattern = ${pattern} AND unit_id <> ${unitId}`);
  await db.execute(sql`INSERT INTO match_rules (id, unit_id, pattern, use_count, created_at, updated_at)
    VALUES (${crypto.randomUUID()}, ${unitId}, ${pattern}, 1, ${now}, ${now})
    ON CONFLICT (unit_id, pattern)
    DO UPDATE SET use_count = match_rules.use_count + 1, updated_at = ${now}`);
}

export async function forgetMatchRule(unitId: string, pattern: string): Promise<boolean> {
  await ensureTable();
  await getDb().execute(sql`DELETE FROM match_rules WHERE unit_id = ${unitId} AND pattern = ${pattern}`);
  return true;
}
