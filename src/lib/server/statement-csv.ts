// SERVER-ONLY. Parses a bank statement CSV (built for Canara Bank exports) into transactions.
//
// Canara Bank statements usually start with a few lines of account details, then a table like:
//   Txn Date, Value Date, Cheque No., Description, Branch Code, Debit, Credit, Balance
// Other layouts are accepted too: a single "Amount" column (with a Dr/Cr column or suffix),
// "Particulars"/"Narration" instead of "Description", "Withdrawals"/"Deposits", etc.
//
// The file comes from the browser, so everything is untrusted: each value is validated and
// cleaned, money is parsed with integer math (never floats), and limits cap the work done.

import { createHash } from "node:crypto";
import Papa from "papaparse";
import type { Category } from "@/data/mockTransactions";

export const MAX_STATEMENT_BYTES = 2 * 1024 * 1024; // 2 MB: years of transactions
export const MAX_STATEMENT_ROWS = 5000;
/** The table header must appear within this many lines from the top. */
const HEADER_SEARCH_ROWS = 40;
/** Ignore absurd amounts (over ₹1,000 crore) rather than let them distort every total. */
const MAX_ABS_MINOR = 1_000_000_000_000;

export class StatementError extends Error {
  constructor(message: string) {
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
  /** Signed paise: money in is positive, money out negative. */
  amountMinor: number;
  /** Running balance after this row, if the statement has one (paise). */
  balanceMinor: number | null;
};

export type ParsedStatement = {
  rows: StatementRow[]; // oldest first
  /** Lines in the table that weren't transactions (totals, opening balance, blanks...). */
  skipped: number;
  periodStart: string;
  periodEnd: string;
  /** Balance after the latest transaction, if the statement has a balance column. */
  closingBalanceMinor: number | null;
};

// ---------- Values ----------

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function isoDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null; // e.g. 31-02
  return date.toISOString().slice(0, 10);
}

/** Indian statements put the day first: 05-04-2026, 05/04/26, 05 Apr 2026, 05-Apr-2026, 2026-04-05. */
export function parseStatementDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[AP]M)?$/i, ""); // drop a time
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(v);
  if (m) return isoDate(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/., ]+(\d{2}|\d{4})$/.exec(v);
  if (m && MONTHS[m[2].toLowerCase()]) return isoDate(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  return null;
}

/**
 * "1,23,456.78", "₹ 500", "Rs.500.5", "(250.00)", "-250", "500.00 Dr" -> signed paise.
 * Returns null for blanks and anything that isn't a clean amount. `drCr` is "dr", "cr" or null.
 */
export function parseAmount(value: unknown): { minor: number; drCr: "dr" | "cr" | null } | null {
  if (typeof value !== "string") return null;
  let v = value.trim().toLowerCase();
  if (!v || v === "-" || v === "--") return null;
  let drCr: "dr" | "cr" | null = null;
  const suffix = /\s*\(?(dr|cr)\)?\.?$/.exec(v);
  if (suffix) {
    drCr = suffix[1] as "dr" | "cr";
    v = v.slice(0, suffix.index);
  }
  v = v.replace(/^(₹|rs\.?|inr)\s*/, "").replace(/[,\s]/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  if (v.startsWith("-")) {
    negative = true;
    v = v.slice(1);
  } else if (v.startsWith("+")) {
    v = v.slice(1);
  }
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(v);
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > MAX_ABS_MINOR) return null;
  return { minor: negative ? -minor : minor, drCr };
}

const cleanText = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** A readable name from a bank narration, e.g. "UPI/DR/412345678901/SWIGGY/YESB/..." -> "Swiggy". */
export function merchantFromDescription(description: string): string {
  const upi = /^UPI\/(?:DR|CR)\/[^/]*\/([^/]+)/i.exec(description);
  if (upi && cleanText(upi[1], 60)) return titleCase(cleanText(upi[1], 60));
  const transfer = /^(NEFT|IMPS|RTGS)[-/:]\s*[^/-]*[-/]\s*([A-Za-z][A-Za-z .&]{2,})/i.exec(description);
  if (transfer) return `${transfer[1].toUpperCase()} ${titleCase(cleanText(transfer[2], 50))}`;
  return description.length > 60 ? `${description.slice(0, 57).trimEnd()}...` : description;
}

const RULES: [Category, RegExp][] = [
  ["housing", /\brent\b|\bmaintenance\b|society|housing|\bemi\b.*home|home ?loan/],
  ["groceries", /bigbasket|big basket|blinkit|zepto|grofers|dmart|d-mart|reliance fresh|more retail|jiomart|grocer|kirana|supermarket|nature'?s basket|spencer/],
  ["dining", /swiggy|zomato|restaurant|cafe|coffee|starbucks|dominos|domino'?s|pizza|mcdonald|kfc|burger|eatsure|food|bakery|hotel/],
  ["transport", /uber|\bola\b|olacabs|rapido|irctc|redbus|metro|fuel|petrol|diesel|hpcl|bpcl|iocl|indian oil|fastag|parking|indigo|air india|vistara|makemytrip/],
  ["subscriptions", /netflix|spotify|hotstar|disney|prime video|amazon prime|youtube|sonyliv|zee5|jiocinema|apple\.com|google play|subscription/],
  ["utilities", /electricity|bescom|tneb|msedcl|tata power|adani electric|bses|water bill|\bgas\b|indane|bharat gas|hp gas|airtel|\bjio\b|vodafone|\bvi\b|bsnl|broadband|recharge|dth|tata ?play|bill ?pay|billdesk/],
  ["shopping", /amazon|flipkart|myntra|ajio|meesho|nykaa|tata cliq|croma|reliance digital|decathlon|ikea|lifestyle|shoppers stop/],
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

function findColumn(header: string[], patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const i = header.findIndex((h) => p.test(h));
    if (i !== -1) return i;
  }
  return null;
}

/** Finds the header row and which column holds what. Exported for tests. */
export function detectColumns(rows: string[][]): { headerIndex: number; columns: Columns } | null {
  for (let r = 0; r < Math.min(rows.length, HEADER_SEARCH_ROWS); r++) {
    const header = rows[r].map(norm);
    const date = findColumn(header, [/^(txn|tran|transaction) ?date$/, /^date$/, /^(txn|tran|transaction) date/, /^posting date$/, /date/]);
    const description = findColumn(header, [/^description$/, /^particulars$/, /^narration$/, /^(transaction )?(remarks|details)$/, /description|particulars|narration/]);
    if (date === null || description === null || date === description) continue;
    const debit = findColumn(header, [/^(debit|withdrawals?|dr)( amount)?$/, /^debit/, /withdrawal/]);
    const credit = findColumn(header, [/^(credit|deposits?|cr)( amount)?$/, /^credit/, /deposit/]);
    const amount = findColumn(header, [/^(txn |transaction )?amount( inr| rs)?$/, /amount/]);
    const drCr = findColumn(header, [/^(dr ?\/ ?cr|cr ?\/ ?dr|dr cr|type|txn type|debit ?\/ ?credit)$/]);
    const balance = findColumn(header, [/^(closing |running |available )?balance( inr| rs)?$/, /balance/]);
    const hasDebitCredit = debit !== null && credit !== null && debit !== credit;
    if (!hasDebitCredit && amount === null) continue;
    return {
      headerIndex: r,
      columns: {
        date,
        description,
        debit: hasDebitCredit ? debit : null,
        credit: hasDebitCredit ? credit : null,
        amount: hasDebitCredit ? null : amount,
        drCr: hasDebitCredit ? null : drCr,
        balance: balance !== null && balance !== debit && balance !== credit && balance !== amount ? balance : null,
      },
    };
  }
  return null;
}

/** Signed paise for one row, or null if the row has no usable amount. */
function rowAmount(row: string[], c: Columns): number | null {
  if (c.debit !== null && c.credit !== null) {
    const debit = parseAmount(row[c.debit]);
    const credit = parseAmount(row[c.credit]);
    const out = debit ? Math.abs(debit.minor) : 0;
    const inn = credit ? Math.abs(credit.minor) : 0;
    if (out > 0 && inn > 0) return null; // ambiguous
    if (out > 0) return -out;
    if (inn > 0) return inn;
    return null;
  }
  if (c.amount === null) return null;
  const amount = parseAmount(row[c.amount]);
  if (!amount || amount.minor === 0) return null;
  const marker = c.drCr !== null ? norm(row[c.drCr]) : "";
  const kind = /^(dr|debit|d|withdrawal)$/.test(marker) ? "dr" : /^(cr|credit|c|deposit)$/.test(marker) ? "cr" : amount.drCr;
  if (kind === "dr") return -Math.abs(amount.minor);
  if (kind === "cr") return Math.abs(amount.minor);
  return amount.minor; // no marker: a minus sign means money out
}

// ---------- Whole file ----------

/** Parses statement text into validated transactions. Throws StatementError with a friendly message. */
export function parseStatementCsv(text: string): ParsedStatement {
  if (typeof text !== "string" || !text.trim()) throw new StatementError("That file is empty.");
  if (text.includes("\u0000")) throw new StatementError("That doesn't look like a CSV file. Please export your statement as CSV.");

  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const table = parsed.data.filter((r): r is string[] => Array.isArray(r));
  const layout = detectColumns(table);
  if (!layout) {
    throw new StatementError(
      "We couldn't find the transaction table. The file needs columns for Date, Description and Amount (or Debit and Credit).",
    );
  }
  const body = table.slice(layout.headerIndex + 1);
  if (body.length > MAX_STATEMENT_ROWS) {
    throw new StatementError(`That statement has more than ${MAX_STATEMENT_ROWS.toLocaleString("en-IN")} rows. Please upload a shorter period.`);
  }

  const { columns: c } = layout;
  let rows: Omit<StatementRow, "externalId">[] = [];
  let skipped = 0;
  for (const row of body) {
    const date = parseStatementDate(row[c.date]);
    const description = cleanText(row[c.description], 300);
    const amountMinor = rowAmount(row, c);
    if (!date || amountMinor === null) {
      skipped++; // opening/closing balance lines, totals, page footers...
      continue;
    }
    const balance = c.balance !== null ? parseAmount(row[c.balance]) : null;
    const safeDescription = description || (amountMinor > 0 ? "Deposit" : "Withdrawal");
    rows.push({
      date,
      merchant: merchantFromDescription(safeDescription),
      description: safeDescription,
      category: categorize(safeDescription, amountMinor > 0),
      amountMinor,
      balanceMinor: balance ? (balance.drCr === "dr" ? -Math.abs(balance.minor) : balance.minor) : null,
    });
  }
  if (rows.length === 0) throw new StatementError("We found the table but no transactions in it. Please check the file.");

  // Some exports list newest first; work oldest first.
  if (rows[0].date > rows[rows.length - 1].date) rows = rows.reverse();

  // Fingerprints: identical rows on the same day (two ₹20 teas) get their own occurrence number.
  const seen = new Map<string, number>();
  const withIds: StatementRow[] = rows.map((r) => {
    const key = [r.date, r.description, r.amountMinor, r.balanceMinor ?? ""].join("|");
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return { ...r, externalId: `csv_${createHash("sha256").update(`${key}|${n}`).digest("hex").slice(0, 40)}` };
  });

  const dates = withIds.map((r) => r.date).sort();
  const last = withIds[withIds.length - 1];
  return {
    rows: withIds,
    skipped,
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
    closingBalanceMinor: last.balanceMinor,
  };
}
