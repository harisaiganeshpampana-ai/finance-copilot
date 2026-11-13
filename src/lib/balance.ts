import type { Transaction } from "@/data/mockTransactions";

export const CURRENCY = "USD";

/**
 * Sum of all transaction amounts, in cents.
 * Throws if any amount is not a whole number of cents, so bad data
 * is caught instead of silently producing a wrong balance.
 */
export function calculateBalanceCents(transactions: Transaction[]): number {
  return transactions.reduce((total, t) => {
    if (!Number.isSafeInteger(t.amountCents)) {
      throw new Error(`Invalid amount for transaction ${t.id}: ${t.amountCents}`);
    }
    return total + t.amountCents;
  }, 0);
}

/** Formats cents as currency, e.g. -123456 -> "-$1,234.56". */
export function formatCents(cents: number, currency: string = CURRENCY): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/**
 * FIXED DEMO RATE: rupees per 1 US dollar. Not a live exchange rate.
 * Replace with a live rate (fetched server-side) before real use.
 */
export const USD_TO_INR_DEMO_RATE = 88;

/** Converts US cents to Indian paise (1/100 rupee), rounded to the nearest paisa. */
export function usdCentsToInrPaise(cents: number, rate: number = USD_TO_INR_DEMO_RATE): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid exchange rate: ${rate}`);
  }
  return Math.round(cents * rate);
}

/** Formats paise as rupees with Indian digit grouping, e.g. 18326352 -> "₹1,83,263.52". */
export function formatInrPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}
