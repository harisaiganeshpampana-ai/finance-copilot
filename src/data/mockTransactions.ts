import type { CurrencyCode, ExchangeRates } from "@/lib/currency";

// Mock data only. Not connected to any bank.
// Amounts are in whole cents to avoid rounding errors:
// positive = money in, negative = money out.

export type Category =
  | "income"
  | "housing"
  | "groceries"
  | "dining"
  | "transport"
  | "shopping"
  | "utilities"
  | "subscriptions"
  | "other";

export type Transaction = {
  id: string;
  date: string; // ISO date, YYYY-MM-DD
  merchant: string;
  category: Category;
  amountCents: number;
  /** Full bank narration, when it differs from the short merchant name (uploaded statements). */
  description?: string;
};

/** The "today" the mock data is written for. Used instead of the real clock so results are stable. */
export const MOCK_AS_OF = "2026-11-12";

/**
 * FIXED DEMO EXCHANGE RATES: units of each currency per 1 US dollar. Not live.
 * Replace with rates fetched server-side before real use.
 */
export const MOCK_EXCHANGE_RATES: ExchangeRates = {
  USD: 1,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.79,
};

/** Account balance at the start of the month, before the transactions below. */
export const MOCK_OPENING_BALANCE_CENTS = 1284000; // $12,840.00

export const mockTransactions: Transaction[] = [
  { id: "t1", date: "2026-11-12", merchant: "Green Basket Grocery", category: "groceries", amountCents: -8423 },
  { id: "t2", date: "2026-11-11", merchant: "StreamBox Subscription", category: "subscriptions", amountCents: -1549 },
  { id: "t3", date: "2026-11-10", merchant: "Corner Fuel Station", category: "transport", amountCents: -4710 },
  { id: "t4", date: "2026-11-09", merchant: "City Power & Light", category: "utilities", amountCents: -11240 },
  { id: "t5", date: "2026-11-08", merchant: "Acme Corp Payroll", category: "income", amountCents: 325000 },
  { id: "t6", date: "2026-11-08", merchant: "ShopNow Online", category: "shopping", amountCents: -3299 },
  { id: "t7", date: "2026-11-07", merchant: "Daily Grind Coffee", category: "dining", amountCents: -675 },
  { id: "t8", date: "2026-11-06", merchant: "QuickRide", category: "transport", amountCents: -1850 },
  { id: "t9", date: "2026-11-01", merchant: "Oakwood Apartments Rent", category: "housing", amountCents: -145000 },
  { id: "t10", date: "2026-11-01", merchant: "Freelance Client Payment", category: "income", amountCents: 60000 },
];

// ---------- Per-user financial data ----------

/** Details of the bank statement a user uploaded (Monthly Financial Audit). */
export type StatementInfo = {
  bank: string;
  fileName: string;
  uploadedAt: string; // ISO timestamp
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
};

/** Everything the dashboard and the AI Copilot need for one user. */
export type FinancialData = {
  transactions: Transaction[];
  /** Whole minor units (cents/paise) of `currency`, like every amount here. */
  openingBalanceCents: number;
  /** "Today" for calculations (YYYY-MM-DD). */
  asOf: string;
  /** Currency of all amounts in this data. Absent means US dollars. */
  currency?: CurrencyCode;
  /** Set when the data comes from an uploaded bank statement. */
  statement?: StatementInfo;
};

/** The original mock data as FinancialData (used in tests and the landing page preview). */
export const MOCK_FINANCIAL_DATA: FinancialData = {
  transactions: mockTransactions,
  openingBalanceCents: MOCK_OPENING_BALANCE_CENTS,
  asOf: MOCK_AS_OF,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/**
 * The 10 sample transactions, re-dated so the most recent falls on `asOf` and the rest keep
 * the same spacing as the original mock data (so "last 7 days" and "this month" look realistic
 * for whenever a user signs up).
 */
export function buildSampleTransactions(asOf: string): Omit<Transaction, "id">[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(utc(asOf))) throw new Error(`Invalid date: ${asOf}`);
  const shift = utc(asOf) - utc(MOCK_AS_OF);
  return mockTransactions.map(({ merchant, category, amountCents, date }) => ({
    merchant,
    category,
    amountCents,
    date: new Date(utc(date) + Math.round(shift / DAY_MS) * DAY_MS).toISOString().slice(0, 10),
  }));
}
