import { describe, expect, it } from "vitest";
import { MOCK_EXCHANGE_RATES as rates } from "@/data/mockTransactions";
import {
  CURRENCY_CODES,
  convertUsdCents,
  formatMinorUnits,
  formatUsdCentsAs,
  isCurrencyCode,
} from "@/lib/currency";

describe("mock exchange rates", () => {
  it("are the fixed demo rates for all four currencies", () => {
    expect(rates).toEqual({ USD: 1, INR: 83.5, EUR: 0.92, GBP: 0.79 });
    expect([...CURRENCY_CODES]).toEqual(["USD", "INR", "EUR", "GBP"]);
  });
});

describe("formatMinorUnits (Intl.NumberFormat per currency)", () => {
  it("uses the Indian numbering system for INR and standard grouping for the rest", () => {
    expect(formatMinorUnits(10000000, "INR")).toBe("₹1,00,000.00");
    expect(formatMinorUnits(10000000, "USD")).toBe("$100,000.00");
    expect(formatMinorUnits(10000000, "EUR")).toBe("€100,000.00");
    expect(formatMinorUnits(10000000, "GBP")).toBe("£100,000.00");
    expect(formatMinorUnits(1000000000, "INR")).toBe("₹1,00,00,000.00"); // one crore
  });

  it("supports whole-number formatting for chart axes", () => {
    expect(formatMinorUnits(12345678, "INR", { decimals: 0 })).toBe("₹1,23,457");
    expect(formatMinorUnits(12345678, "USD", { decimals: 0 })).toBe("$123,457");
  });
});

describe("convertUsdCents", () => {
  it("converts $1.00 into each currency's minor unit", () => {
    expect(convertUsdCents(100, "USD", rates)).toBe(100);
    expect(convertUsdCents(100, "INR", rates)).toBe(8350);
    expect(convertUsdCents(100, "EUR", rates)).toBe(92);
    expect(convertUsdCents(100, "GBP", rates)).toBe(79);
  });

  it("rounds to the nearest minor unit and never returns -0", () => {
    expect(convertUsdCents(1492254, "EUR", rates)).toBe(1372874); // 1,372,873.68
    expect(Object.is(convertUsdCents(0, "INR", rates), 0)).toBe(true);
  });

  it("rejects bad amounts, unknown currencies and bad rates", () => {
    expect(() => convertUsdCents(10.5, "INR", rates)).toThrow();
    // @ts-expect-error: JPY is not a supported currency
    expect(() => convertUsdCents(100, "JPY", rates)).toThrow(/Unsupported/);
    expect(() => convertUsdCents(100, "INR", { ...rates, INR: 0 })).toThrow();
    expect(() => convertUsdCents(100, "EUR", { ...rates, EUR: Number.NaN })).toThrow();
  });
});

describe("formatUsdCentsAs", () => {
  it("shows the mock balance ($14,922.54) in every currency", () => {
    expect(formatUsdCentsAs(1492254, "USD", rates)).toBe("$14,922.54");
    expect(formatUsdCentsAs(1492254, "INR", rates)).toBe("₹12,46,032.09");
    expect(formatUsdCentsAs(1492254, "EUR", rates)).toBe("€13,728.74");
    expect(formatUsdCentsAs(1492254, "GBP", rates)).toBe("£11,788.81");
  });

  it("formats negative amounts", () => {
    expect(formatUsdCentsAs(-1549, "INR", rates)).toBe("-₹1,293.41");
    expect(formatUsdCentsAs(-1549, "GBP", rates)).toBe("-£12.24");
  });
});

describe("isCurrencyCode", () => {
  it("accepts only supported codes", () => {
    expect(isCurrencyCode("INR")).toBe(true);
    expect(isCurrencyCode("inr")).toBe(false);
    expect(isCurrencyCode("JPY")).toBe(false);
    expect(isCurrencyCode(null)).toBe(false);
  });
});
