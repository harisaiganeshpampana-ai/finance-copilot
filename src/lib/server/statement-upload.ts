// SERVER-ONLY. Saves an uploaded bank statement (Monthly Financial Audit) to the user's account.
// Any bank, any country: PDF, Excel or CSV. The built-in reader goes first; if it can't
// understand the layout, AI extraction is the fallback. Amounts are stored exactly in the
// statement's own currency, which becomes the user's data currency.
// Dependencies are injectable so this can be tested without a database or AI provider.

import type { StatementInfo } from "@/data/mockTransactions";
import { CURRENCY_INFO, type CurrencyCode, isCurrencyCode } from "@/lib/currency";
import type { StatementImportResult } from "@/lib/statement-types";
import { getProviders, type Provider } from "@/lib/server/copilot";
import { aiExtractStatement } from "@/lib/server/statement-ai";
import { extractStatement } from "@/lib/server/statement-extract";
import {
  columnsFromHeader,
  detectBankInfo,
  detectCurrency,
  detectUnsupportedCurrency,
  finalizeStatement,
  type ParsedStatement,
  readStatementLines,
  readStatementTable,
  layoutHints,
  StatementError,
  type StatementRow,
} from "@/lib/server/statement-parser";
import { assertUserId } from "@/lib/server/transactions";

export type StatementStore = {
  /** The user's data currency and how many uploaded / other real (non-sample) rows they have. */
  getProfile(userId: string): Promise<{ currency: CurrencyCode; otherRows: number; uploadedRows: number }>;
  /** Removes sample data, then inserts new rows and updates rows already uploaded (by externalId). */
  saveRows(userId: string, rows: StatementRow[]): Promise<{ inserted: number }>;
  /** Signed sum of all uploaded rows (minor units). */
  sumUploaded(userId: string): Promise<number>;
  saveProfile(
    userId: string,
    profile: { currency: CurrencyCode; statement: StatementInfo; openingBalanceMinor?: number },
  ): Promise<void>;
};

export class StatementConflictError extends Error {
  constructor(
    readonly existing: CurrencyCode,
    readonly incoming: CurrencyCode,
  ) {
    super(
      `Your account already has statements in ${existing} (${CURRENCY_INFO[existing].symbol}), and this one is in ${incoming} (${CURRENCY_INFO[incoming].symbol}). One account can hold one currency for now.`,
    );
    this.name = "StatementConflictError";
  }
}

export type { StatementImportResult };

export type ImportDeps = {
  store?: StatementStore;
  providers?: Provider[];
  fetchImpl?: typeof fetch;
  now?: Date;
};

async function defaultStore(): Promise<StatementStore> {
  const { mongoStatementStore } = await import("@/lib/server/statement-store");
  return mongoStatementStore;
}

/** Cleans a file name for display ("../../x.csv" -> "x.csv"). */
export function safeFileName(name: unknown): string {
  const base = typeof name === "string" ? (name.split(/[\\/]/).pop() ?? "") : "";
  return base.replace(/[^\w .()-]/g, "").trim().slice(0, 120) || "statement";
}

const isHeader = (cells: string[]) => columnsFromHeader(cells) !== null;

/** Reads the file into transactions: built-in reader first, AI fallback second. */
export async function readStatement(
  file: { bytes: Uint8Array; password?: string; currency?: CurrencyCode | null },
  deps: ImportDeps = {},
): Promise<{ parsed: ParsedStatement; currency: CurrencyCode; bank: string; method: "reader" | "ai" }> {
  const extracted = await extractStatement(file.bytes, { password: file.password, isHeader });
  let currency: CurrencyCode | null = file.currency ?? detectCurrency(extracted.text);
  const bankInfo = detectBankInfo(extracted.text);
  let bank = bankInfo?.name ?? null;

  const unsupported = !currency ? detectUnsupportedCurrency(extracted.text) : null;
  if (unsupported) {
    throw new StatementError(
      `This statement looks like it's in ${unsupported}. CalmOwe supports statements in rupees, dollars, euros and pounds for now.`,
      "unsupported_currency",
    );
  }
  // Nothing in the text said which currency: use the bank's home currency, if it has one.
  currency = currency ?? bankInfo?.currency ?? null;

  let parsed: ParsedStatement | null = null;
  let method: "reader" | "ai" = "reader";
  for (const table of extracted.tables) {
    const read = readStatementTable(table, currency);
    if (read) {
      parsed = finalizeStatement(read.transactions, read.skipped);
      break;
    }
  }
  if (!parsed) {
    // Second built-in try: line by line, using the running balance.
    const read = readStatementLines(extracted.text, currency);
    if (read && read.transactions.length > 0) parsed = finalizeStatement(read.transactions, read.skipped);
  }

  if (!parsed) {
    console.warn(`[statements] Built-in reader failed (${extracted.kind}); layout hints: ${layoutHints(extracted.text)}`);
    const ai = await aiExtractStatement(extracted.text, deps.providers ?? getProviders(), { fetchImpl: deps.fetchImpl, today: deps.now });
    parsed = finalizeStatement(ai.transactions, ai.rejected);
    method = "ai";
    bank = bank ?? ai.bank;
    if (!currency && ai.currency) {
      if (!isCurrencyCode(ai.currency)) {
        throw new StatementError(
          `This statement looks like it's in ${ai.currency}. CalmOwe supports statements in rupees, dollars, euros and pounds for now.`,
          "unsupported_currency",
        );
      }
      currency = ai.currency;
    }
  }

  if (!currency) {
    throw new StatementError("We couldn't tell which currency this statement is in. Please choose it and upload again.", "currency_required");
  }
  return { parsed, currency, bank: bank ?? "Bank statement", method };
}

/** Reads and saves a statement for one user. Throws StatementError / StatementConflictError. */
export async function importStatement(
  userId: string,
  file: { name: string; bytes: Uint8Array; password?: string; currency?: CurrencyCode | null },
  deps: ImportDeps = {},
): Promise<StatementImportResult> {
  assertUserId(userId);
  const now = deps.now ?? new Date();
  // Read and validate everything before touching the database.
  const { parsed, currency, bank, method } = await readStatement(file, { ...deps, now });
  const db = deps.store ?? (await defaultStore());

  const profile = await db.getProfile(userId);
  // Never mix currencies in one account (that would corrupt every total).
  if ((profile.otherRows > 0 || profile.uploadedRows > 0) && profile.currency !== currency) {
    throw new StatementConflictError(profile.currency, currency);
  }

  const { inserted } = await db.saveRows(userId, parsed.rows);

  // Opening balance = the statement's closing balance minus everything uploaded, so the app's
  // balance (opening + transactions) matches the bank's figure after the latest transaction.
  let openingBalanceMinor: number | undefined;
  if (parsed.closingBalanceMinor !== null) {
    const candidate = parsed.closingBalanceMinor - (await db.sumUploaded(userId));
    if (Number.isSafeInteger(candidate)) openingBalanceMinor = candidate;
  } else if (profile.uploadedRows === 0) {
    openingBalanceMinor = 0; // replace the sample data's opening balance
  }

  await db.saveProfile(userId, {
    currency,
    openingBalanceMinor,
    statement: {
      bank,
      fileName: safeFileName(file.name),
      uploadedAt: now.toISOString(),
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
    },
  });

  const moneyInMinor = parsed.rows.filter((r) => r.amountMinor > 0).reduce((s, r) => s + r.amountMinor, 0);
  const moneyOutMinor = parsed.rows.filter((r) => r.amountMinor < 0).reduce((s, r) => s - r.amountMinor, 0);
  return {
    imported: inserted,
    alreadyUploaded: parsed.rows.length - inserted,
    skipped: parsed.skipped,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    moneyInMinor,
    moneyOutMinor,
    currency,
    bank,
    method,
  };
}
