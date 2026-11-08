export type ParsedBankRow = {
  date: string;
  description: string;
  amountCents: number;
};

export type MatchCandidate = {
  unitId: string;
  reason: string;
  automatic: boolean;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseIsoDate(value: string): string {
  const input = value.trim();
  if (isValidIsoDate(input)) return input;
  const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (usDate) {
    const normalized = `${usDate[3]}-${usDate[1]!.padStart(2, "0")}-${usDate[2]!.padStart(2, "0")}`;
    if (isValidIsoDate(normalized)) return normalized;
  }
  throw new Error(`Could not read the date “${input}”. Use YYYY-MM-DD or MM/DD/YYYY.`);
}

export function parseMoneyCents(value: string): number {
  const cleaned = value.trim().replace(/[,$\s]/g, "");
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) throw new Error(`Could not read the amount “${value}”.`);
  const cents = BigInt(match[2]!) * 100n + BigInt((match[3] ?? "").padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("The amount is too large to import.");
  const result = Number(cents);
  return match[1] ? -result : result;
}

export function findMatchCandidate(
  description: string,
  amountCents: number,
  units: Array<{ id: string; unitLabel: string; tenantName: string; rentCents: number; paidCents: number }>,
  rules: Array<{ unitId: string; pattern: string; useCount: number }> = [],
): MatchCandidate | null {
  const normalized = description.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const occupiedUnits = units.filter((unit) => unit.tenantName.trim() !== "");
  // Learned rules lead: the landlord has confirmed this wording before, so it
  // counts as a reference for the unit they pointed it at.
  const learned = rules.filter((rule) => {
    const pattern = rule.pattern.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return pattern.length > 0 && normalized.includes(pattern);
  });
  const learnedUnitIds = Array.from(new Set(learned.map((rule) => rule.unitId)));
  if (learnedUnitIds.length === 1 && learned[0]) {
    const unit = occupiedUnits.find((item) => item.id === learnedUnitIds[0]);
    if (unit) {
      const balance = unit.rentCents - unit.paidCents;
      const amountMatches = amountCents === balance || (unit.paidCents === 0 && amountCents === unit.rentCents);
      const trusted = learned.some((rule) => rule.useCount >= 2);
      return {
        unitId: unit.id,
        reason: trusted
          ? `Learned from your earlier matches: "${learned[0].pattern}" has meant ${unit.unitLabel} more than once`
          : `Learned from an earlier match: "${learned[0].pattern}" meant ${unit.unitLabel}`,
        automatic: trusted && amountMatches,
      };
    }
  }
  const referenced = occupiedUnits.filter((unit) => {
    const label = unit.unitLabel.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return label.length > 0 && normalized.includes(label);
  });
  if (referenced.length === 1 && referenced[0]) {
    const unit = referenced[0];
    const balance = unit.rentCents - unit.paidCents;
    const amountMatches = amountCents === balance || (unit.paidCents === 0 && amountCents === unit.rentCents);
    return {
      unitId: unit.id,
      reason: amountMatches
        ? `Reference ${unit.unitLabel} and exact amount`
        : `Reference ${unit.unitLabel}; amount needs a quick check`,
      automatic: amountMatches,
    };
  }
  const amountMatches = occupiedUnits.filter(
    (unit) => unit.rentCents - unit.paidCents === amountCents,
  );
  if (amountMatches.length === 1 && amountMatches[0]) {
    return {
      unitId: amountMatches[0].id,
      reason: "Exact amount; payment reference is unclear",
      automatic: false,
    };
  }
  return null;
}

export function isValidIsoMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const monthNumber = Number(value.slice(5, 7));
  return monthNumber >= 1 && monthNumber <= 12;
}

export function getMonthRange(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  if (year === undefined || monthNumber === undefined || monthNumber < 1 || monthNumber > 12) throw new Error("Month must use YYYY-MM format.");
  const endYear = monthNumber === 12 ? year + 1 : year;
  const endMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return { start: `${year}-${String(monthNumber).padStart(2, "0")}-01`, end: `${endYear}-${String(endMonth).padStart(2, "0")}-01` };
}

export function getTodayIsoDate(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getWeekStartDate(today: string, weekStart: "Monday" | "Sunday"): string {
  const date = new Date(`${today}T00:00:00Z`);
  const weekStartDay = weekStart === "Sunday" ? 0 : 1;
  const offset = (date.getUTCDay() - weekStartDay + 7) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export function getDaysLate(dueDate: string, today: string): number {
  const [dueYear, dueMonth, dueDay] = dueDate.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  if (dueYear === undefined || dueMonth === undefined || dueDay === undefined || todayYear === undefined || todayMonth === undefined || todayDay === undefined) return 0;
  const dueOrdinal = Math.floor(Date.UTC(dueYear, dueMonth - 1, dueDay) / 86_400_000);
  const todayOrdinal = Math.floor(Date.UTC(todayYear, todayMonth - 1, todayDay) / 86_400_000);
  return Math.max(0, todayOrdinal - dueOrdinal);
}

export function formatCents(cents: number, symbol = "$", includeCents = false): string {
  const whole = (cents - (cents % 100)) / 100;
  const fraction = cents % 100;
  return `${symbol}${new Intl.NumberFormat("en-US").format(whole)}${includeCents || fraction ? `.${String(fraction).padStart(2, "0")}` : ""}`;
}

export function renderReminderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (token, key: string) => values[key] ?? token);
}
