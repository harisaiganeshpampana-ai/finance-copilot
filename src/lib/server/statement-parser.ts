// SERVER-ONLY. Turns a bank statement table (from CSV, Excel or PDF, see statement-extract.ts)
// into validated transactions. Works for any bank whose table has a date, a description and
// either an amount (with Dr/Cr or a sign) or separate debit/credit columns. It works out:
//   - where the table starts (statements often begin with account details),
//   - day-first (05/04 = 5 April) vs month-first (US) dates,
//   - decimal commas (1.234,56) vs decimal points (1,234.56 or Indian 1,23,456.78),
//   - which currency the statement is in, and which bank it's from.
// Anything it can't read falls back to AI extraction (statement-ai.ts).
//
// The file comes from the browser, so everything is untrusted: each value is validated and
// cleaned, money is parsed with integer math (never floats), and limits cap the work done.

import { createHash } from "node:crypto";
import Papa from "papaparse";
import type { Category } from "@/data/mockTransactions";
import type { CurrencyCode } from "@/lib/currency";

export const MAX_STATEMENT_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel's request limit is 4.5 MB)
export const MAX_STATEMENT_ROWS = 5000;
/** The table header must appear within this many lines from the top. */
const HEADER_SEARCH_ROWS = 60;
/** Ignore absurd amounts (over 10 billion) rather than let them distort every total. */
const MAX_ABS_MINOR = 1_000_000_000_000;

export type StatementErrorCode = "password_required" | "password_incorrect" | "currency_required" | "unsupported_currency";

export class StatementError extends Error {
  constructor(
    message: string,
    readonly code?: StatementErrorCode,
  ) {
    super(message);
    this.name = "StatementError";
  }
}

export type StatementRow = {
  /** Fingerprint of the row, so uploading the same statement twice never duplicates it. */
  externalId: string;
  date: string; // YYYY-MM-DD
  /** Short, readable name (e.g. "Swiggy" from a UPI narration). */
  merchant: string;
  /** The full narration from the bank. */
  description: string;
  category: Category;
  /** Signed minor units (cents/paise): money in is positive, money out negative. */
  amountMinor: number;
  /** Running balance after this row, if the statement has one (minor units). */
  balanceMinor: number | null;
};

/** A transaction before categorizing and fingerprinting (from the table reader or the AI). */
export type RawTransaction = { date: string; description: string; amountMinor: number; balanceMinor: number | null };

export type ParsedStatement = {
  rows: StatementRow[]; // oldest first
  /** Lines that weren't transactions (totals, opening balance, blanks...). */
  skipped: number;
  periodStart: string;
  periodEnd: string;
  /** Balance after the latest transaction, if the statement has a balance column. */
  closingBalanceMinor: number | null;
};

// ---------- Dates ----------

export type DateOrder = "dmy" | "mdy";

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function isoDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null; // e.g. 31-02
  return date.toISOString().slice(0, 10);
}

const stripTime = (v: string) =>
  v.trim().replace(/[T\s]+\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(\s*[AP]M)?(Z|[+-]\d{2}:?\d{2})?$/i, "");

/**
 * Parses a statement date. Numeric dates like 05/04/2026 are ambiguous, so `order` says
 * whether the day (most of the world) or the month (US) comes first. Also accepts
 * 2026-04-05, "5 Apr 2026", "05-Apr-26" and "Apr 5, 2026".
 */
export function parseStatementDate(value: unknown, order: DateOrder = "dmy"): string | null {
  if (typeof value !== "string") return null;
  const v = stripTime(value);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(v);
  if (m) return order === "mdy" ? isoDate(+m[3], +m[1], +m[2]) : isoDate(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*\.?[-/., ]+(\d{2}|\d{4})$/.exec(v);
  if (m && MONTHS[m[2].toLowerCase()]) return isoDate(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  m = /^([A-Za-z]{3})[A-Za-z]*\.?[-/ ](\d{1,2}),?[-/ ]+(\d{2}|\d{4})$/.exec(v);
  if (m && MONTHS[m[1].toLowerCase()]) return isoDate(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  return null;
}

/** Decides day-first vs month-first from the dates in the file (a part over 12 settles it). */
export function detectDateOrder(values: unknown[], currency: CurrencyCode | null): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const value of values) {
    if (typeof value !== "string") continue;
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(stripTime(value));
    if (!m) continue;
    if (+m[1] > 12 && +m[2] <= 12) dmy++;
    if (+m[2] > 12 && +m[1] <= 12) mdy++;
  }
  if (dmy !== mdy) return dmy > mdy ? "dmy" : "mdy";
  return currency === "USD" ? "mdy" : "dmy";
}

// ---------- Amounts ----------

/** True if amounts in the file use a decimal comma (1.234,56 or 12,50). */
export function detectDecimalComma(values: unknown[]): boolean {
  let comma = 0;
  let point = 0;
  for (const value of values) {
    if (typeof value !== "string") continue;
    const v = value.replace(/[^\d.,]/g, "");
    if (/,\d{2}$/.test(v) && !/\.\d{2}$/.test(v)) comma++;
    else if (/\.\d{1,2}$/.test(v)) point++;
  }
  return comma > point;
}

/**
 * "1,23,456.78", "₹ 500", "$1,200", "(250.00)", "-250", "500.00 Dr", "1.234,56 €" -> signed
 * minor units. Returns null for blanks and anything that isn't a clean amount.
 * `drCr` is "dr", "cr" or null.
 */
export function parseAmount(value: unknown, decimalComma = false): { minor: number; drCr: "dr" | "cr" | null } | null {
  if (typeof value !== "string") return null;
  let v = value.trim().toLowerCase();
  if (!v || v === "-" || v === "--") return null;
  let drCr: "dr" | "cr" | null = null;
  const suffix = /\s*\(?(dr|cr|debit|credit)\)?\.?$/.exec(v);
  if (suffix) {
    drCr = suffix[1].startsWith("d") ? "dr" : "cr";
    v = v.slice(0, suffix.index);
  }
  v = v
    .replace(/^(₹|rs\.?|inr|usd|us\$|\$|eur|€|gbp|£)\s*/, "")
    .replace(/\s*(₹|inr|usd|\$|eur|€|gbp|£)$/, "")
    .replace(/[\s ']/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  if (v.endsWith("-")) {
    negative = true; // "250.00-"
    v = v.slice(0, -1);
  }
  if (v.startsWith("-")) {
    negative = true;
    v = v.slice(1);
  } else if (v.startsWith("+")) {
    v = v.slice(1);
  }
  v = v.replace(/^(₹|rs\.?|\$|€|£)/, "");
  const [thousands, decimal] = decimalComma ? [".", ","] : [",", "."];
  if (!new RegExp(`^\\d{1,3}(\\${thousands}?\\d{2,3})*(\\${decimal}\\d{1,2})?$`).test(v)) return null;
  const [whole, frac = ""] = v.split(thousands).join("").split(decimal);
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > MAX_ABS_MINOR) return null;
  return { minor: negative ? -minor : minor, drCr };
}

// ---------- Currency and bank ----------

const CURRENCY_PATTERNS: [CurrencyCode, RegExp][] = [
  ["INR", /₹|\bINR\b|\bRs\.?\s?\d|\b[A-Z]{4}0[A-Z0-9]{6}\b|\bIFSC\b|\bUPI\b|\bNEFT\b|\bIMPS\b/g],
  ["USD", /\bUSD\b|US\$|\$\s?\d|\bACH\b|\bZelle\b|\bRouting\b/g],
  ["EUR", /€|\bEUR\b|\bIBAN\b|\bSEPA\b/g],
  ["GBP", /£|\bGBP\b|\bSort code\b|\bFaster Payment/gi],
];
const UNSUPPORTED_CURRENCY = /\b(AED|SAR|QAR|KWD|OMR|BHD|SGD|AUD|NZD|CAD|JPY|CNY|HKD|CHF|SEK|NOK|DKK|ZAR|MYR|THB|IDR|PHP|PKR|BDT|LKR|NPR|BRL|MXN)\b/g;

/** The statement's currency from symbols, codes and banking terms, or null if unclear. */
export function detectCurrency(text: string): CurrencyCode | null {
  const sample = text.slice(0, 200_000);
  const scores = CURRENCY_PATTERNS.map(([code, re]) => [code, sample.match(re)?.length ?? 0] as const).sort((a, b) => b[1] - a[1]);
  const [best, second] = scores;
  if (best[1] === 0 || best[1] === second[1]) return null;
  // A statement mainly in an unsupported currency (e.g. AED) shouldn't be read as dollars.
  const unsupported = sample.match(UNSUPPORTED_CURRENCY)?.length ?? 0;
  if (unsupported > best[1]) return null;
  return best[0];
}

/** An unsupported currency code that dominates the text (e.g. "AED"), if any. */
export function detectUnsupportedCurrency(text: string): string | null {
  const counts = new Map<string, number>();
  for (const m of text.slice(0, 200_000).matchAll(UNSUPPORTED_CURRENCY)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 3 ? top[0] : null;
}

/** Known banks, how they're written, and their home currency (a hint when nothing else says). */
const BANKS: [string, RegExp, CurrencyCode | null][] = [
  ["State Bank of India", /state bank of india|\bSBI\b|\bSBIN0/gi, "INR"],
  ["HDFC Bank", /\bHDFC\b/gi, "INR"],
  ["ICICI Bank", /\bICICI\b/gi, "INR"],
  ["Axis Bank", /\baxis bank\b|\bUTIB0/gi, "INR"],
  ["Kotak Mahindra Bank", /\bkotak\b/gi, "INR"],
  ["Canara Bank", /\bcanara\b|\bCNRB0/gi, "INR"],
  ["Punjab National Bank", /punjab national bank|\bPUNB0/gi, "INR"],
  ["Bank of Baroda", /bank of baroda|\bBARB0/gi, "INR"],
  ["Union Bank of India", /union bank of india/gi, "INR"],
  ["IDFC FIRST Bank", /\bIDFC\b/gi, "INR"],
  ["Yes Bank", /\byes bank\b/gi, "INR"],
  ["IndusInd Bank", /\bindusind\b/gi, "INR"],
  ["Federal Bank", /\bfederal bank\b/gi, "INR"],
  ["Bank of India", /\bbank of india\b/gi, "INR"],
  ["Indian Bank", /\bindian bank\b/gi, "INR"],
  ["Chase", /\bchase\b|jpmorgan/gi, "USD"],
  ["Bank of America", /bank of america/gi, "USD"],
  ["Wells Fargo", /wells fargo/gi, "USD"],
  ["Capital One", /capital one/gi, "USD"],
  ["Citibank", /\bcitibank\b/gi, null],
  ["HSBC", /\bHSBC\b/gi, null],
  ["Barclays", /\bbarclays\b/gi, "GBP"],
  ["Lloyds Bank", /\blloyds\b/gi, "GBP"],
  ["NatWest", /\bnatwest\b/gi, "GBP"],
  ["Monzo", /\bmonzo\b/gi, "GBP"],
  ["Santander", /\bsantander\b/gi, null],
  ["Revolut", /\brevolut\b/gi, null],
  ["Deutsche Bank", /deutsche bank/gi, "EUR"],
  ["ING", /\bING\b/g, "EUR"],
  ["BNP Paribas", /\bBNP\b/gi, "EUR"],
];

/**
 * The bank named earliest in the statement (the header usually comes first). Mentions inside
 * UPI handles like "chai@sbi" are other people's banks, so they're ignored.
 */
export function detectBankInfo(text: string): { name: string; currency: CurrencyCode | null } | null {
  const head = text.slice(0, 20_000);
  let best: { name: string; currency: CurrencyCode | null; index: number } | null = null;
  for (const [name, re, currency] of BANKS) {
    for (const m of head.matchAll(re)) {
      if (head[m.index - 1] === "@") continue;
      if (!best || m.index < best.index) best = { name, currency, index: m.index };
      break;
    }
  }
  return best ? { name: best.name, currency: best.currency } : null;
}

export const detectBank = (text: string) => detectBankInfo(text)?.name ?? null;

// ---------- Merchants and categories ----------

const cleanText = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** A readable name from a bank narration, e.g. "UPI/DR/412345678901/SWIGGY/YESB/..." -> "Swiggy". */
export function merchantFromDescription(description: string): string {
  const upi = /^UPI\/(?:DR|CR|P2M|P2A)\/[^/]*\/([^/]+)/i.exec(description);
  if (upi && cleanText(upi[1], 60)) return titleCase(cleanText(upi[1], 60));
  const transfer = /^(NEFT|IMPS|RTGS)[-/:]\s*[^/-]*[-/]\s*([A-Za-z][A-Za-z .&]{2,})/i.exec(description);
  if (transfer) return `${transfer[1].toUpperCase()} ${titleCase(cleanText(transfer[2], 50))}`;
  const card = /^(?:POS|PURCHASE|CARD PURCHASE|DEBIT CARD PURCHASE|VISA|MC)\s*[-:]?\s*(?:\d{2}\/\d{2}\s+)?(.+)$/i.exec(description);
  if (card && cleanText(card[1], 60)) return cleanText(card[1], 60);
  return description.length > 60 ? `${description.slice(0, 57).trimEnd()}...` : description;
}

const RULES: [Category, RegExp][] = [
  ["housing", /\brent\b|\bmaintenance\b|society|housing|mortgage|\bemi\b.*home|home ?loan|letting|landlord/],
  ["groceries", /bigbasket|big basket|blinkit|zepto|grofers|dmart|d-mart|reliance fresh|more retail|jiomart|grocer|kirana|supermarket|nature'?s basket|spencer|walmart|costco|kroger|safeway|whole foods|trader joe|aldi|lidl|tesco|sainsbury|asda|morrisons|waitrose|carrefour|rewe|edeka/],
  ["dining", /swiggy|zomato|restaurant|cafe|coffee|starbucks|dominos|domino'?s|pizza|mcdonald|kfc|burger|eatsure|food|bakery|doordash|grubhub|uber ?eats|deliveroo|just eat|chipotle|subway|pret/],
  ["transport", /uber|\bola\b|olacabs|rapido|irctc|redbus|fuel|petrol|diesel|hpcl|bpcl|iocl|indian oil|fastag|parking|indigo|air india|vistara|makemytrip|lyft|\bmetro\b|\bshell\b|chevron|exxon|\bbp\b|texaco|\besso\b|\btfl\b|transit|airline|airways|ryanair|easyjet|\btrains?\b|railway|\btolls?\b/],
  ["subscriptions", /netflix|spotify|hotstar|disney|prime video|amazon prime|youtube|sonyliv|zee5|jiocinema|apple\.com|google play|subscription|hulu|hbo|max\.com|paramount|audible|icloud|adobe|microsoft 365|chatgpt|openai/],
  ["utilities", /electricity|bescom|tneb|msedcl|tata power|adani electric|bses|water bill|\bgas\b|indane|bharat gas|hp gas|airtel|\bjio\b|vodafone|\bvi\b|bsnl|broadband|recharge|dth|tata ?play|bill ?pay|billdesk|comcast|xfinity|verizon|at&t|t-mobile|spectrum|pg&e|con ?ed|duke energy|british gas|octopus energy|edf|thames water|council tax|\bee\b|virgin media/],
  ["shopping", /amazon|flipkart|myntra|ajio|meesho|nykaa|tata cliq|croma|reliance digital|decathlon|ikea|lifestyle|shoppers stop|target|best buy|ebay|etsy|argos|primark|zara|h&m|\bh & m\b|marks (and|&) spencer|john lewis|apple store/],
];

/** Picks a category from the narration. Money in is "income"; unknown spending is "other". */
export function categorize(description: string, moneyIn: boolean): Category {
  if (moneyIn) return "income";
  const d = description.toLowerCase();
  for (const [category, pattern] of RULES) if (pattern.test(d)) return category;
  return "other";
}

// ---------- Table layout ----------

type Columns = {
  date: number;
  description: number;
  debit: number | null;
  credit: number | null;
  amount: number | null;
  drCr: number | null;
  balance: number | null;
};

const norm = (cell: unknown) =>
  typeof cell === "string" ? cell.toLowerCase().replace(/[^a-z/ ]/g, " ").replace(/\s+/g, " ").trim() : "";

function findColumn(header: string[], patterns: RegExp[], exclude: (number | null)[] = []): number | null {
  for (const p of patterns) {
    const i = header.findIndex((h, idx) => p.test(h) && !exclude.includes(idx));
    if (i !== -1) return i;
  }
  return null;
}

/** Finds the header row and which column holds what. Exported for tests and the PDF reader. */
export function detectColumns(rows: string[][]): { headerIndex: number; columns: Columns } | null {
  for (let r = 0; r < Math.min(rows.length, HEADER_SEARCH_ROWS); r++) {
    const columns = columnsFromHeader(rows[r]);
    if (columns) return { headerIndex: r, columns };
  }
  return null;
}

/** Which column holds what, if this row looks like a transaction table header. */
export function columnsFromHeader(row: string[]): Columns | null {
  const header = row.map(norm);
  const date = findColumn(header, [
    /^(txn|tran|trans|transaction|posting|post|booking|value)? ?date$/,
    /^(txn|tran|transaction|posting|booking) date/,
    /^date/,
    /date/,
    // German, French, Spanish, Italian, Dutch, Portuguese
    /^(buchungstag|buchungsdatum|datum|wertstellung|valuta|fecha|data|date operation|date valeur)$/,
  ]);
  const description = findColumn(
    header,
    [
      /^description$/,
      /^particulars$/,
      /^narration$/,
      /^(transaction )?(remarks|details)$/,
      /^(payee|merchant|memo|reference|transaction)$/,
      /description|particulars|narration|details|remarks/,
      /^(verwendungszweck|buchungstext|beschreibung|libell|concepto|descripci n|descrizione|omschrijving|descri o)$/,
    ],
    [date],
  );
  if (date === null || description === null) return null;
  const used = [date, description];
  const debit = findColumn(header, [/^(debit|debits|withdrawals?|withdrawal amt|dr|paid out|money out|out)( amount| amt)?$/, /^debit/, /withdrawal|paid out|money out/, /^(soll|d bit|cargo|addebito)$/], used);
  const credit = findColumn(header, [/^(credit|credits|deposits?|deposit amt|cr|paid in|money in|in)( amount| amt)?$/, /^credit/, /deposit|paid in|money in/, /^(haben|cr dit|abono|accredito)$/], used);
  const amount = findColumn(header, [/^(txn |transaction )?amount( inr| rs| usd| eur| gbp)?$/, /amount/, /^(betrag|montant|importe|importo|bedrag|valor)( eur)?$/], used);
  const drCr = findColumn(header, [/^(dr ?\/ ?cr|cr ?\/ ?dr|dr cr|type|txn type|transaction type|debit ?\/ ?credit|d\/c|c\/d)$/], used);
  const balance = findColumn(header, [/^(closing |running |available |ledger )?balance( inr| rs| usd| eur| gbp)?$/, /balance/, /^(saldo|solde|kontostand)$/], used);
  const hasDebitCredit = debit !== null && credit !== null && debit !== credit;
  if (!hasDebitCredit && amount === null) return null;
  return {
    date,
    description,
    debit: hasDebitCredit ? debit : null,
    credit: hasDebitCredit ? credit : null,
    amount: hasDebitCredit ? null : amount,
    drCr: hasDebitCredit ? null : drCr,
    balance: balance !== null && balance !== debit && balance !== credit && balance !== amount ? balance : null,
  };
}

/** Signed minor units for one row, or null if the row has no usable amount. */
function rowAmount(row: string[], c: Columns, decimalComma: boolean): number | null {
  if (c.debit !== null && c.credit !== null) {
    const debit = parseAmount(row[c.debit], decimalComma);
    const credit = parseAmount(row[c.credit], decimalComma);
    const out = debit ? Math.abs(debit.minor) : 0;
    const inn = credit ? Math.abs(credit.minor) : 0;
    if (out > 0 && inn > 0) return null; // ambiguous
    if (out > 0) return -out;
    if (inn > 0) return inn;
    return null;
  }
  if (c.amount === null) return null;
  const amount = parseAmount(row[c.amount], decimalComma);
  if (!amount || amount.minor === 0) return null;
  const marker = c.drCr !== null ? norm(row[c.drCr]) : "";
  const kind = /^(dr|debit|d|withdrawal|out)$/.test(marker) ? "dr" : /^(cr|credit|c|deposit|in)$/.test(marker) ? "cr" : amount.drCr;
  if (kind === "dr") return -Math.abs(amount.minor);
  if (kind === "cr") return Math.abs(amount.minor);
  return amount.minor; // no marker: a minus sign means money out
}

/** Reads a table (rows of cells) into raw transactions, or null if it isn't a statement table. */
export function readStatementTable(
  table: string[][],
  currency: CurrencyCode | null,
): { transactions: RawTransaction[]; skipped: number } | null {
  const layout = detectColumns(table);
  if (!layout) return null;
  const body = table.slice(layout.headerIndex + 1);
  if (body.length > MAX_STATEMENT_ROWS) {
    throw new StatementError(`That statement has more than ${MAX_STATEMENT_ROWS.toLocaleString("en-US")} rows. Please upload a shorter period.`);
  }
  const { columns: c } = layout;
  const order = detectDateOrder(body.map((r) => r[c.date]), currency);
  const amountCells = body.flatMap((r) => [c.debit, c.credit, c.amount, c.balance].map((i) => (i === null ? undefined : r[i])));
  const decimalComma = detectDecimalComma(amountCells);

  const transactions: RawTransaction[] = [];
  let skipped = 0;
  for (const row of body) {
    const date = parseStatementDate(row[c.date], order);
    const amountMinor = rowAmount(row, c, decimalComma);
    if (!date || amountMinor === null) {
      skipped++; // opening/closing balance lines, totals, repeated headers, page footers...
      continue;
    }
    const balance = c.balance !== null ? parseAmount(row[c.balance], decimalComma) : null;
    transactions.push({
      date,
      description: cleanText(row[c.description], 300),
      amountMinor,
      balanceMinor: balance ? (balance.drCr === "dr" ? -Math.abs(balance.minor) : balance.minor) : null,
    });
  }
  return transactions.length > 0 ? { transactions, skipped } : null;
}

/** Categorizes, orders (oldest first) and fingerprints raw transactions. */
export function finalizeStatement(raw: RawTransaction[], skipped: number): ParsedStatement {
  if (raw.length === 0) throw new StatementError("We couldn't find any transactions in that statement.");
  if (raw.length > MAX_STATEMENT_ROWS) {
    throw new StatementError(`That statement has more than ${MAX_STATEMENT_ROWS.toLocaleString("en-US")} transactions. Please upload a shorter period.`);
  }
  let rows = raw.map((r) => {
    const description = cleanText(r.description, 300) || (r.amountMinor > 0 ? "Deposit" : "Withdrawal");
    return {
      date: r.date,
      merchant: merchantFromDescription(description),
      description,
      category: categorize(description, r.amountMinor > 0),
      amountMinor: r.amountMinor,
      balanceMinor: r.balanceMinor,
    };
  });
  // Some exports list newest first; work oldest first.
  if (rows[0].date > rows[rows.length - 1].date) rows = rows.reverse();

  // Fingerprints: identical rows on the same day (two ₹20 teas) get their own occurrence number.
  // (Same formula as the first CSV release, so earlier uploads still match.)
  const seen = new Map<string, number>();
  const withIds: StatementRow[] = rows.map((r) => {
    const key = [r.date, r.description, r.amountMinor, r.balanceMinor ?? ""].join("|");
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return { ...r, externalId: `csv_${createHash("sha256").update(`${key}|${n}`).digest("hex").slice(0, 40)}` };
  });

  const dates = withIds.map((r) => r.date).sort();
  return {
    rows: withIds,
    skipped,
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
    closingBalanceMinor: withIds[withIds.length - 1].balanceMinor,
  };
}

/** Splits delimited text (comma, semicolon, tab or pipe; detected automatically) into rows. */
export function csvToTable(text: string): string[][] {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  return parsed.data.filter((r): r is string[] => Array.isArray(r)).map((r) => r.map((c) => (typeof c === "string" ? c : String(c ?? ""))));
}

/** Parses statement CSV text (kept for simple callers and tests). */
export function parseStatementCsv(text: string, currency: CurrencyCode | null = null): ParsedStatement {
  if (typeof text !== "string" || !text.trim()) throw new StatementError("That file is empty.");
  if (text.includes("\u0000")) throw new StatementError("That doesn't look like a statement file. Please upload a PDF, Excel or CSV statement.");
  const read = readStatementTable(csvToTable(text), currency ?? detectCurrency(text));
  if (!read) {
    throw new StatementError(
      "We couldn't find the transaction table. The file needs columns for Date, Description and Amount (or Debit and Credit).",
    );
  }
  return finalizeStatement(read.transactions, read.skipped);
}

// ---------- Line-by-line reader (PDFs whose columns don't line up) ----------

const LINE_DATE =
  /^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/. ][A-Za-z]{3,9}\.?[-/., ]+\d{2,4}|[A-Za-z]{3,9}\.? \d{1,2},? \d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?(?=\s|$)/;
// Money always has two decimals here, so reference numbers and cheque numbers aren't mistaken for amounts.
const LINE_AMOUNT = /(?<![\w.,/])(-?\(?(?:₹|Rs\.?|\$|€|£)?\s?\d{1,3}(?:[,.']\d{2,3})*[.,]\d{2}\)?-?)(\s?(?:Dr|Cr|DR|CR)\b\.?)?(?![\w/])/g;
const NOT_A_TRANSACTION = /\b(opening|closing|available|ledger) balance\b|\btotal\b|statement (period|date)|brought forward|carried forward|\bb\/f\b|\bc\/f\b/i;
const MONEY_IN_WORDS = /\b(salary|credit|cr|deposit|refund|interest|reversal|cashback|received|neft cr|imps cr|upi\/cr)\b/i;

type LineRow = { date: string; description: string; amount: number; sign: 1 | -1 | null; balance: number | null };

/**
 * Reads statements printed as lines: "date  description  amount  balance". When the
 * amount has no Dr/Cr or minus sign, the change in the running balance tells whether money
 * came in or went out. Returns null unless the balances agree with the amounts.
 */
export function readStatementLines(text: string, currency: CurrencyCode | null): { transactions: RawTransaction[]; skipped: number } | null {
  const rawDates: string[] = [];
  const pending: (Omit<LineRow, "date" | "amount" | "balance"> & { rawDate: string; amountText: string; balanceText: string | null })[] = [];
  let skipped = 0;
  const lines = text.split("\n").slice(0, MAX_STATEMENT_ROWS * 3);
  for (const line of lines) {
    const dm = LINE_DATE.exec(line);
    if (!dm) {
      // A wrapped description line (no date, no money) belongs to the transaction above.
      const last = pending[pending.length - 1];
      if (last && line.trim() && !LINE_AMOUNT.test(line) && line.trim().length < 120) last.description += ` ${line.trim()}`;
      LINE_AMOUNT.lastIndex = 0;
      continue;
    }
    let rest = line.slice(dm[0].length);
    rest = rest.replace(LINE_DATE, ""); // a second "value date" column
    const tokens = [...rest.matchAll(LINE_AMOUNT)];
    if (tokens.length === 0 || NOT_A_TRANSACTION.test(rest) || /^\s*(to|-)\s*\d/.test(rest)) {
      skipped++;
      continue;
    }
    // Ignore 0.00 placeholders in empty Debit/Credit columns.
    const useful = tokens.length >= 3 ? tokens.filter((t) => !/^[^1-9]*$/.test(t[1])) : tokens;
    const amountTok = useful.length >= 2 ? useful[useful.length - 2] : useful[useful.length - 1];
    const balanceTok = useful.length >= 2 ? useful[useful.length - 1] : null;
    const marker = (amountTok[2] ?? "").trim().toLowerCase();
    const negative = /^-|^\(|-$/.test(amountTok[1].trim());
    pending.push({
      rawDate: dm[1],
      description: rest.slice(0, tokens[0].index).replace(/\s+/g, " ").trim(),
      amountText: `${amountTok[1]}${amountTok[2] ?? ""}`,
      balanceText: balanceTok ? `${balanceTok[1]}${balanceTok[2] ?? ""}` : null,
      sign: marker.startsWith("dr") || negative ? -1 : marker.startsWith("cr") ? 1 : null,
    });
    rawDates.push(dm[1]);
  }
  if (pending.length === 0) return null;

  const order = detectDateOrder(rawDates, currency);
  const decimalComma = detectDecimalComma(pending.flatMap((p) => [p.amountText, p.balanceText ?? ""]));
  const rows: LineRow[] = [];
  for (const p of pending) {
    const date = parseStatementDate(p.rawDate, order);
    const amount = parseAmount(p.amountText, decimalComma);
    const balance = p.balanceText ? parseAmount(p.balanceText, decimalComma) : null;
    if (!date || !amount || amount.minor === 0) {
      skipped++;
      continue;
    }
    rows.push({
      date,
      description: p.description,
      amount: Math.abs(amount.minor),
      sign: p.sign,
      balance: balance ? (balance.drCr === "dr" ? -Math.abs(balance.minor) : balance.minor) : null,
    });
  }
  if (rows.length === 0) return null;

  const unsigned = rows.filter((r) => r.sign === null);
  if (unsigned.length > 0) {
    // Which way does the balance run? Oldest-first: balance[i] = balance[i-1] ± amount[i].
    const fits = (newestFirst: boolean) => {
      let ok = 0;
      for (let i = 0; i < rows.length; i++) {
        const prev = newestFirst ? rows[i + 1] : rows[i - 1];
        if (prev?.balance != null && rows[i].balance != null && Math.abs(rows[i].balance! - prev.balance) === rows[i].amount) ok++;
      }
      return ok;
    };
    const asc = fits(false);
    const desc = fits(true);
    const newestFirst = desc > asc;
    const best = Math.max(asc, desc);
    const withBalance = rows.filter((r) => r.balance !== null).length;
    // Without enough agreeing balances, we can't tell money in from money out: let the AI try.
    if (withBalance < 2 || best < Math.max(1, Math.floor((withBalance - 1) * 0.8))) return null;

    const opening = /opening balance[^\d\n-]{0,40}(-?[\d.,]+\d)/i.exec(text);
    const openingMinor = opening ? parseAmount(opening[1], decimalComma)?.minor ?? null : null;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.sign !== null) continue;
      const prev = newestFirst ? rows[i + 1] : rows[i - 1];
      const prevBalance = prev ? prev.balance : openingMinor;
      if (r.balance !== null && prevBalance != null && Math.abs(r.balance - prevBalance) === r.amount) {
        r.sign = r.balance >= prevBalance ? 1 : -1;
      } else {
        r.sign = MONEY_IN_WORDS.test(r.description) ? 1 : -1; // best guess for the very first row
      }
    }
  }
  return {
    transactions: rows.map((r) => ({ date: r.date, description: r.description, amountMinor: r.amount * (r.sign ?? -1), balanceMinor: r.balance })),
    skipped,
  };
}

// ---------- Privacy-safe diagnostics ----------

const HEADER_WORDS = /\b(date|description|narration|particulars|details|remarks|debit|credit|withdrawals?|deposits?|balance|amount|dr|cr)\b/gi;

/**
 * A short, anonymous picture of a statement's layout for the server log when reading fails,
 * so the reader can be improved: likely header lines (digits masked) and the *shape* of two
 * transaction lines (every letter -> "a", every digit -> "9"). No names, numbers or amounts.
 */
export function layoutHints(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const headers = lines
    .filter((l) => l.length < 200 && (l.match(HEADER_WORDS)?.length ?? 0) >= 2)
    .slice(0, 3)
    .map((l) => l.replace(/\d/g, "9"));
  const shapes = lines
    .filter((l) => LINE_DATE.test(l))
    .slice(0, 2)
    .map((l) => l.slice(0, 160).replace(/[A-Za-z]/g, "a").replace(/\d/g, "9"));
  return JSON.stringify({ lines: lines.length, headers, shapes });
}
