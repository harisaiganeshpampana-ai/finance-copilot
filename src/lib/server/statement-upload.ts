// SERVER-ONLY. Saves an uploaded bank statement (Monthly Financial Audit) to the user's account.
// Amounts are stored as exact rupees (paise) and the user's data currency becomes INR.
// The store is injectable so this can be tested without a real database.

import type { StatementInfo } from "@/data/mockTransactions";
import type { CurrencyCode } from "@/lib/currency";
import type { StatementImportResult } from "@/lib/statement-types";
import { parseStatementCsv, type StatementRow } from "@/lib/server/statement-csv";
import { assertUserId } from "@/lib/server/transactions";

export const STATEMENT_CURRENCY: CurrencyCode = "INR";
export const STATEMENT_BANK = "Canara Bank";

export type StatementStore = {
  /** Currency of the user's existing data, and how many rows aren't sample or uploaded data. */
  getProfile(userId: string): Promise<{ currency: CurrencyCode; otherRows: number }>;
  /** Removes sample data, then inserts new rows and updates rows already uploaded (by externalId). */
  saveRows(userId: string, rows: StatementRow[]): Promise<{ inserted: number }>;
  /** Signed sum of all uploaded rows (paise). */
  sumUploaded(userId: string): Promise<number>;
  saveProfile(
    userId: string,
    profile: { currency: CurrencyCode; statement: StatementInfo; openingBalanceMinor?: number },
  ): Promise<void>;
};

export class StatementConflictError extends Error {
  constructor() {
    super("This account already has transactions in another currency.");
    this.name = "StatementConflictError";
  }
}

export type { StatementImportResult };

async function defaultStore(): Promise<StatementStore> {
  const { mongoStatementStore } = await import("@/lib/server/statement-store");
  return mongoStatementStore;
}

/** Cleans a file name for display ("../../x.csv" -> "x.csv"). */
export function safeFileName(name: unknown): string {
  const base = typeof name === "string" ? name.split(/[\\/]/).pop() ?? "" : "";
  return base.replace(/[^\w .()-]/g, "").trim().slice(0, 120) || "statement.csv";
}

/** Parses and saves a statement for one user. Throws StatementError / StatementConflictError. */
export async function importStatement(
  userId: string,
  file: { name: string; text: string },
  store?: StatementStore,
  now: Date = new Date(),
): Promise<StatementImportResult> {
  assertUserId(userId);
  const parsed = parseStatementCsv(file.text); // validates before touching the database
  const db = store ?? (await defaultStore());

  const profile = await db.getProfile(userId);
  // Never mix rupees with other real data in another currency (that would corrupt totals).
  if (profile.otherRows > 0 && profile.currency !== STATEMENT_CURRENCY) throw new StatementConflictError();

  const { inserted } = await db.saveRows(userId, parsed.rows);

  // Opening balance = the statement's closing balance minus everything uploaded, so the app's
  // balance (opening + transactions) matches the bank's figure after the latest transaction.
  let openingBalanceMinor: number | undefined;
  if (parsed.closingBalanceMinor !== null) {
    const candidate = parsed.closingBalanceMinor - (await db.sumUploaded(userId));
    if (Number.isSafeInteger(candidate)) openingBalanceMinor = candidate;
  } else if (profile.currency !== STATEMENT_CURRENCY) {
    openingBalanceMinor = 0; // the old balance was in another currency (e.g. sample dollars)
  }

  await db.saveProfile(userId, {
    currency: STATEMENT_CURRENCY,
    openingBalanceMinor,
    statement: {
      bank: STATEMENT_BANK,
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
    currency: STATEMENT_CURRENCY,
  };
}
