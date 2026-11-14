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

/** Adds one calendar month to an ISO date, clamping to the month's last day (Jan 31 -> Feb 28). */
export function addOneMonth(date: string): string {
  assertIsoDate(date);
  const [y, m, d] = date.split("-").map(Number);
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/** Categories treated as monthly recurring bills when estimating what's coming up. */
export const RECURRING_CATEGORIES = ["housing", "utilities", "subscriptions"] as const;

export type UpcomingBill = { merchant: string; category: string; expectedDate: string; amountCents: number };

/**
 * Estimates bills due in the next `horizonDays` after `asOf`, assuming each recurring
 * expense (rent, utilities, subscriptions) repeats one month after it last occurred.
 * Amounts are positive cents. Sorted by expected date.
 */
export function estimateUpcomingBills(transactions: Transaction[], asOf: string, horizonDays = 30): UpcomingBill[] {
  assertIsoDate(asOf);
  const start = Date.parse(`${asOf}T00:00:00Z`);
  const end = start + horizonDays * DAY_MS;
  const latestByMerchant = new Map<string, Transaction>();
  for (const t of transactions) {
    if (t.amountCents >= 0 || t.date > asOf) continue;
    if (!(RECURRING_CATEGORIES as readonly string[]).includes(t.category)) continue;
    const prev = latestByMerchant.get(t.merchant);
    if (!prev || t.date > prev.date) latestByMerchant.set(t.merchant, t);
  }
  return [...latestByMerchant.values()]
    .map((t) => ({ merchant: t.merchant, category: t.category, expectedDate: addOneMonth(t.date), amountCents: 0 - t.amountCents }))
    .filter((b) => {
      const due = Date.parse(`${b.expectedDate}T00:00:00Z`);
      return due > start && due <= end;
    })
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
}
