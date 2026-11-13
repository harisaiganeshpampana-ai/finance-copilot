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
// Multi-currency conversion and formatting live in `@/lib/currency`.
