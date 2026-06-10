import type { ParsedTransaction } from "@/db/schema";

/**
 * Heuristic parser that extracts transaction candidates from bank statement
 * PDF text. Banks vary wildly, so this aims for high recall — everything goes
 * through the human review screen before being saved.
 *
 * Recognized line shapes (most common across major US banks):
 *   01/15  AMAZON MKTPLACE          -54.23
 *   01/15/2026  DIRECT DEPOSIT PAYROLL  2,150.00
 *   Jan 15  STARBUCKS #1234  4.85
 *   01/15  PAYMENT THANK YOU  (1,200.00)
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// e.g. 1,234.56 / -54.23 / (1,200.00) / $89.99 — must have cents
const AMOUNT_RE = /\(?-?\$?\d{1,3}(?:,\d{3})*\.\d{2}\)?-?/g;

const NUMERIC_DATE_RE = /^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/;
const WORD_DATE_RE = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/;

const SKIP_PATTERNS =
  /\b(beginning balance|ending balance|previous balance|new balance|balance forward|total|page \d|statement period|account number|minimum payment|available credit|annual percentage|apr\b|interest charged|fees? charged)\b/i;

const DEPOSIT_HINTS =
  /\b(deposit|payroll|direct dep|salary|refund|credit|interest paid|cashback|reimburse|payment received|zelle from|transfer from)\b/i;

function parseAmount(raw: string): { cents: number; negative: boolean } {
  const negative = raw.includes("(") || raw.includes("-");
  const cents = Math.round(
    parseFloat(raw.replace(/[()$,\-]/g, "")) * 100
  );
  return { cents, negative };
}

function parseDate(line: string, fallbackYear: number): { date: string; rest: string } | null {
  let m = line.match(NUMERIC_DATE_RE);
  if (m) {
    const month = parseInt(m[1]);
    const day = parseInt(m[2]);
    let year = m[3] ? parseInt(m[3]) : fallbackYear;
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return {
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      rest: line.slice(m[0].length),
    };
  }
  m = line.match(WORD_DATE_RE);
  if (m) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (!month) return null;
    const day = parseInt(m[2]);
    const year = m[3] ? parseInt(m[3]) : fallbackYear;
    if (day < 1 || day > 31) return null;
    return {
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      rest: line.slice(m[0].length),
    };
  }
  return null;
}

export function parseStatementText(text: string): ParsedTransaction[] {
  const year = new Date().getFullYear();
  const results: ParsedTransaction[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/\s{2,}/g, "  ");
    if (line.length < 8 || SKIP_PATTERNS.test(line)) continue;

    const dated = parseDate(line, year);
    if (!dated) continue;

    const amounts = [...dated.rest.matchAll(AMOUNT_RE)].map((m) => m[0]);
    if (amounts.length === 0) continue;

    // The transaction amount is usually the first amount after the
    // description; a second amount is typically a running balance.
    const { cents, negative } = parseAmount(amounts[0]);
    if (!cents || cents > 100_000_000) continue; // skip $0 and > $1M noise

    const description = dated.rest
      .replace(AMOUNT_RE, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 120);
    if (description.length < 2) continue;

    const type: ParsedTransaction["type"] = negative
      ? "withdrawal"
      : DEPOSIT_HINTS.test(description)
        ? "deposit"
        : "withdrawal";

    results.push({ date: dated.date, description, amountCents: cents, type });
  }

  return results.slice(0, 500);
}
