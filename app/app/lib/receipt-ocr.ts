/**
 * Read a single transfer-receipt screenshot into a draft payment.
 *
 * OCR runs entirely in the browser with tesseract.js: the image never leaves
 * the landlord's machine and no assistant request is spent. The result is
 * always a *draft* — the Payments screen shows it for editing, and nothing is
 * saved until the landlord confirms. Tenants who can't produce a CSV can send
 * a screenshot of their transfer instead.
 */
export type ReceiptDraft = {
  fileName: string;
  /** ISO YYYY-MM-DD, editable by the landlord before saving. */
  date: string;
  amountCents: number;
  description: string;
  /** Everything OCR thought it saw, shown so the reading can be checked. */
  rawText: string;
  /** OCR's own confidence, 0–1. */
  confidence: number;
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif)$/i.test(file.name);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Nigerian and European receipts are day-first, so day-first is the default.
 * Only flip to month-first when the first number cannot be a day at all.
 */
function fromNumericDate(text: string): string | null {
  const match = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/.exec(text);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (first > 12 && second <= 12) return iso(year, second, first);
  // Ambiguous (both <= 12): day-first, because that is the Nigerian convention,
  // and the draft is shown for correction before anything is saved.
  return iso(year, second, first) ?? iso(year, first, second);
}

function fromTextDate(text: string): string | null {
  const dayFirst = /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/.exec(text);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2]!.slice(0, 3).toLowerCase()];
    if (month) {
      const parsed = iso(Number(dayFirst[3]), Number(month), Number(dayFirst[1]));
      if (parsed) return parsed;
    }
  }
  const monthFirst = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/.exec(text);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1]!.slice(0, 3).toLowerCase()];
    if (month) {
      const parsed = iso(Number(monthFirst[3]), Number(month), Number(monthFirst[2]));
      if (parsed) return parsed;
    }
  }
  return null;
}

function toCents(raw: string): number {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole = "0", decimals = ""] = cleaned.split(".");
  const cents = Number(whole || "0") * 100 + Number(`${decimals}00`.slice(0, 2));
  return Number.isFinite(cents) ? cents : 0;
}

/**
 * The amount on a receipt is the largest money figure on it — the transfer
 * value dwarfs balances, fees and account numbers. Currency-labelled figures
 * win over bare numbers.
 */
function findAmountCents(text: string): number {
  const candidates: number[] = [];
  const labelled = /(?:₦|NGN|N\s?|USD|US\$|\$|£|€)\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
  for (const match of text.matchAll(labelled)) candidates.push(toCents(match[1] ?? ""));
  if (candidates.length === 0) {
    for (const match of text.matchAll(/\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b/g)) candidates.push(toCents(match[0]));
  }
  if (candidates.length === 0) {
    for (const match of text.matchAll(/\b\d+\.\d{2}\b/g)) candidates.push(toCents(match[0]));
  }
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function findDescription(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const labelled = lines.find((line) =>
    /(narration|description|remark|reference|details|beneficiary|sender|from|paid by)\b/i.test(line),
  );
  if (labelled) {
    const separator = labelled.indexOf(":");
    const value = separator >= 0 ? labelled.slice(separator + 1) : labelled;
    if (value.trim().length > 2) return value.trim().slice(0, 120);
  }
  const named = lines.find((line) => /[A-Za-z]{3,}/.test(line) && !/\d{1,2}[/.\-]\d{1,2}/.test(line));
  return (named ?? "Tenant transfer").slice(0, 120);
}

export function parseReceiptText(
  text: string,
  fallbackDate: string,
): Pick<ReceiptDraft, "date" | "amountCents" | "description"> {
  return {
    date: fromNumericDate(text) ?? fromTextDate(text) ?? fallbackDate,
    amountCents: findAmountCents(text),
    description: findDescription(text),
  };
}

type TesseractApi = { createWorker: (lang?: string) => Promise<any> };

/**
 * The package's main entry is CommonJS, which reaches the browser unconverted
 * in some bundler setups and throws "require is not defined". Load the prebuilt
 * ESM bundle directly and fall back to the package entry if it is unavailable.
 */
async function loadTesseract(): Promise<TesseractApi> {
  try {
    // @ts-ignore - the dist bundle ships no type declarations
    const module = await import("tesseract.js/dist/tesseract.esm.min.js");
    const api = (module.default ?? module) as Partial<TesseractApi>;
    if (typeof api.createWorker === "function") return api as TesseractApi;
  }
  catch {
    // fall through to the package entry
  }
  return (await import("tesseract.js")) as unknown as TesseractApi;
}

export async function readReceipt(file: File, fallbackDate: string): Promise<ReceiptDraft> {
  let createWorker: (lang?: string) => Promise<any>;
  try {
    ({ createWorker } = await loadTesseract());
  }
  catch (error) {
    throw new Error(`OCR library failed to load (${(error as Error)?.message ?? String(error)})`);
  }
  let worker: any;
  try {
    worker = await createWorker("eng");
  }
  catch (error) {
    throw new Error(`OCR worker failed to start (${(error as Error)?.message ?? String(error)})`);
  }
  try {
    const { data } = await worker.recognize(file);
    const rawText = (data.text ?? "").trim();
    if (!rawText) {
      throw new Error("No text was found in that screenshot. Try a clearer, well-lit photo.");
    }
    return {
      fileName: file.name,
      rawText,
      confidence: (data.confidence ?? 0) / 100,
      ...parseReceiptText(rawText, fallbackDate),
    };
  }
  finally {
    await worker.terminate();
  }
}
