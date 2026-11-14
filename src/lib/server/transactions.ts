// SERVER-ONLY. Per-user financial data in MongoDB.
// Every read and write is scoped to one userId, so users only ever see their own data.
// The store is injectable so this logic can be tested without a real database.

import {
  buildSampleTransactions,
  type FinancialData,
  MOCK_OPENING_BALANCE_CENTS,
  type StatementInfo,
  type Transaction,
} from "@/data/mockTransactions";
import type { CurrencyCode } from "@/lib/currency";

export type NewTransaction = Omit<Transaction, "id">;

export type TransactionStore = {
  listByUser(userId: string): Promise<Transaction[]>;
  countByUser(userId: string): Promise<number>;
  insertForUser(userId: string, transactions: NewTransaction[]): Promise<void>;
  getOpeningBalance(userId: string): Promise<number>;
  setOpeningBalance(userId: string, cents: number): Promise<void>;
  /** The currency of the user's data and their uploaded statement, if any. Absent = USD, none. */
  getDataProfile?(userId: string): Promise<{ currency: CurrencyCode; statement: StatementInfo | null }>;
};

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function assertUserId(userId: unknown): asserts userId is string {
  if (typeof userId !== "string" || !OBJECT_ID.test(userId)) throw new Error("Invalid user id");
}

/** Today's date (UTC) as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function defaultStore(): Promise<TransactionStore> {
  const { mongoTransactionStore } = await import("@/lib/server/transaction-store");
  return mongoTransactionStore;
}

/** The logged-in user's transactions and balance, ready for the dashboard and the Copilot. */
export async function getFinancialData(userId: string, store?: TransactionStore, today = todayIso()): Promise<FinancialData> {
  assertUserId(userId);
  const db = store ?? (await defaultStore());
  const [transactions, openingBalanceCents, profile] = await Promise.all([
    db.listByUser(userId),
    db.getOpeningBalance(userId),
    db.getDataProfile ? db.getDataProfile(userId) : null,
  ]);
  const latestTransaction = transactions.reduce((max, t) => (t.date > max ? t.date : max), "");
  if (profile?.statement && latestTransaction) {
    // Uploaded statement (Monthly Financial Audit): calculations are "as of" the statement's
    // latest transaction, so last month's statement shows last month's totals.
    return { transactions, openingBalanceCents, asOf: latestTransaction, currency: profile.currency, statement: profile.statement };
  }
  // Calculations use today's date, or the latest transaction if it's later (e.g. timezone edge).
  const asOf = latestTransaction > today ? latestTransaction : today;
  return { transactions, openingBalanceCents, asOf, ...(profile && profile.currency !== "USD" ? { currency: profile.currency } : {}) };
}

/**
 * Gives a user the 10 sample transactions (dated around `today`) and the sample opening
 * balance. Only runs if the user has no transactions yet, so it can never create duplicates.
 */
export async function seedSampleData(
  userId: string,
  store?: TransactionStore,
  today = todayIso(),
): Promise<{ created: boolean; count: number }> {
  assertUserId(userId);
  const db = store ?? (await defaultStore());
  if ((await db.countByUser(userId)) > 0) return { created: false, count: 0 };
  const sample = buildSampleTransactions(today);
  await db.insertForUser(userId, sample);
  await db.setOpeningBalance(userId, MOCK_OPENING_BALANCE_CENTS);
  return { created: true, count: sample.length };
}

/** Seed after sign-up without ever failing the sign-up itself. */
export async function seedSampleDataSafely(userId: string): Promise<void> {
  try {
    await seedSampleData(userId);
  } catch (err) {
    console.error("[data] Could not create sample data:", err instanceof Error ? err.message : err);
  }
}
