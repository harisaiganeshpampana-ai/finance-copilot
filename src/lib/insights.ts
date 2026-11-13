import type { Transaction } from "@/data/mockTransactions";
import { calculateBalanceCents } from "@/lib/balance";

const DAY_MS = 24 * 60 * 60 * 1000;

function assertIsoDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`Invalid date: ${date}`);
  }
}

/** Current balance = opening balance + every transaction since. */
export function totalBalanceCents(openingBalanceCents: number, transactions: Transaction[]): number {
  if (!Number.isSafeInteger(openingBalanceCents)) {
    throw new Error(`Invalid opening balance: ${openingBalanceCents}`);
  }
  return openingBalanceCents + calculateBalanceCents(transactions);
}

/** Percent change from one value to another, e.g. 100 -> 125 = 25. Returns null if `from` is 0. */
export function percentChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

/** Formats a percent with a sign and one decimal, e.g. 16.219 -> "+16.2%". */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}

/** Income and expenses (as positive numbers) for the calendar month containing `asOf`, up to and including `asOf`. */
export function monthTotals(
  transactions: Transaction[],
  asOf: string,
): { incomeCents: number; expensesCents: number } {
  assertIsoDate(asOf);
  const monthPrefix = asOf.slice(0, 7);
  const inMonth = transactions.filter((t) => t.date.startsWith(monthPrefix) && t.date <= asOf);
  const incomeCents = calculateBalanceCents(inMonth.filter((t) => t.amountCents > 0));
  // `0 - x` rather than `-x` so an empty sum is 0, not -0.
  const expensesCents = 0 - calculateBalanceCents(inMonth.filter((t) => t.amountCents < 0));
  return { incomeCents, expensesCents };
}

export type DailySpending = { date: string; spendingCents: number };

/** Spending (positive cents) for each of the `days` days ending on `asOf`, oldest first. Days with none are 0. */
export function dailySpending(transactions: Transaction[], asOf: string, days = 7): DailySpending[] {
  assertIsoDate(asOf);
  if (!Number.isInteger(days) || days < 1) throw new Error(`Invalid number of days: ${days}`);
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const series: DailySpending[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(end - i * DAY_MS).toISOString().slice(0, 10);
    const spent = transactions.filter((t) => t.date === date && t.amountCents < 0);
    series.push({ date, spendingCents: 0 - calculateBalanceCents(spent) });
  }
  return series;
}
