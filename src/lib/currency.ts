// Multi-currency helpers. All amounts are stored in US cents; we convert to the
// display currency's minor unit (paise, euro cents, pence) and format with Intl.

export const CURRENCY_CODES = ["USD", "INR", "EUR", "GBP"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export type ExchangeRates = Record<CurrencyCode, number>; // units of currency per 1 USD

export const CURRENCY_INFO: Record<CurrencyCode, { symbol: string; name: string; locale: string }> = {
  USD: { symbol: "$", name: "US Dollar", locale: "en-US" },
  INR: { symbol: "₹", name: "Indian Rupee", locale: "en-IN" }, // Indian grouping: 1,00,000.00
  EUR: { symbol: "€", name: "Euro", locale: "en-IE" },
  GBP: { symbol: "£", name: "British Pound", locale: "en-GB" },
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}

/** Converts US cents to the target currency's minor unit, rounded to the nearest unit. */
export function convertUsdCents(cents: number, to: CurrencyCode, rates: ExchangeRates): number {
  if (!Number.isSafeInteger(cents)) throw new Error(`Invalid amount: ${cents}`);
  if (!isCurrencyCode(to)) throw new Error(`Unsupported currency: ${String(to)}`);
  const rate = rates[to];
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Invalid exchange rate for ${to}: ${rate}`);
  // `0 +` turns -0 into 0.
  return 0 + Math.round(cents * rate);
}

/** Formats an amount in minor units (e.g. paise) using the currency's own number style. */
export function formatMinorUnits(
  minor: number,
  currency: CurrencyCode,
  { decimals = 2 }: { decimals?: 0 | 2 } = {},
): string {
  return new Intl.NumberFormat(CURRENCY_INFO[currency].locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minor / 100);
}

/** Convert from US cents and format in one step. */
export function formatUsdCentsAs(
  cents: number,
  currency: CurrencyCode,
  rates: ExchangeRates,
  options?: { decimals?: 0 | 2 },
): string {
  return formatMinorUnits(convertUsdCents(cents, currency, rates), currency, options);
}
