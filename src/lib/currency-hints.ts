import { type CurrencyCode, type ExchangeRates, formatMinorUnits } from "@/lib/currency";

// Finds money amounts in a question (e.g. "₹5,000", "Rs 1200", "50 euros", "$300")
// and converts them exactly, so the AI never has to do currency math itself.

const SYMBOLS: Record<string, CurrencyCode> = {
  "₹": "INR",
  rs: "INR",
  "rs.": "INR",
  inr: "INR",
  $: "USD",
  usd: "USD",
  "€": "EUR",
  eur: "EUR",
  "£": "GBP",
  gbp: "GBP",
};
const WORDS: Record<string, CurrencyCode> = {
  inr: "INR",
  rupee: "INR",
  rupees: "INR",
  usd: "USD",
  dollar: "USD",
  dollars: "USD",
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  gbp: "GBP",
  pound: "GBP",
  pounds: "GBP",
};

const NUMBER = String.raw`(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
// "₹5,000" / "Rs. 5000" / "INR 5,000" / "$300"
const PREFIX = new RegExp(String.raw`(₹|\$|€|£|\brs\.?|\binr\b|\busd\b|\beur\b|\bgbp\b)\s?${NUMBER}`, "gi");
// "5000 rupees" / "50 euros" / "300 USD"
const SUFFIX = new RegExp(String.raw`${NUMBER}\s?(inr|usd|eur|gbp|rupees?|dollars?|euros?|pounds?)\b`, "gi");

export type FoundAmount = { text: string; amount: number; currency: CurrencyCode };

const MAX_AMOUNTS = 5;

export function findAmounts(message: string): FoundAmount[] {
  const found: (FoundAmount & { index: number })[] = [];
  for (const m of message.matchAll(PREFIX)) {
    const currency = SYMBOLS[m[1].toLowerCase()];
    if (currency) found.push({ text: m[0].trim(), amount: Number(m[2].replace(/,/g, "")), currency, index: m.index ?? 0 });
  }
  for (const m of message.matchAll(SUFFIX)) {
    const currency = WORDS[m[2].toLowerCase()];
    const index = m.index ?? 0;
    // Skip if this number was already captured with a prefix symbol.
    if (currency && !found.some((f) => Math.abs(f.index - index) <= 4)) {
      found.push({ text: m[0].trim(), amount: Number(m[1].replace(/,/g, "")), currency, index });
    }
  }
  return found
    .filter((f) => Number.isFinite(f.amount) && f.amount > 0 && f.amount < 1e12)
    .sort((a, b) => a.index - b.index)
    .slice(0, MAX_AMOUNTS)
    .map(({ text, amount, currency }) => ({ text, amount, currency }));
}

/** Converts an amount between currencies via USD; returns minor units of the target. */
export function convertAmount(amount: number, from: CurrencyCode, to: CurrencyCode, rates: ExchangeRates): number {
  const usd = amount / rates[from];
  return Math.round(usd * rates[to] * 100);
}

/**
 * Lines like "₹5,000 (INR) = $59.88 USD" for each amount in the question, plus the
 * display currency when it differs. Empty if the question has no amounts.
 */
export function currencyHints(message: string, display: CurrencyCode, rates: ExchangeRates): string[] {
  return findAmounts(message).flatMap(({ text, amount, currency }) => {
    const targets = Array.from(new Set<CurrencyCode>(["USD", display])).filter((c) => c !== currency);
    if (targets.length === 0) return []; // already in the data's and the user's currency; nothing to convert
    const original = formatMinorUnits(Math.round(amount * 100), currency);
    const converted = targets
      .map((t) => `${formatMinorUnits(convertAmount(amount, currency, t, rates), t)} ${t}`)
      .join(" = ");
    return [`"${text}" means ${original} (${currency}) = ${converted}.`];
  });
}
