import { describe, expect, it } from "vitest";
import { MOCK_EXCHANGE_RATES as rates } from "@/data/mockTransactions";
import { convertAmount, currencyHints, findAmounts } from "@/lib/currency-hints";

describe("findAmounts", () => {
  it.each([
    ["Can I afford a ₹5,000 purchase?", 5000, "INR"],
    ["Can I afford a ₹1,00,000 laptop?", 100000, "INR"],
    ["Is Rs 1200 ok?", 1200, "INR"],
    ["Is Rs. 1200 ok?", 1200, "INR"],
    ["INR 750 for dinner?", 750, "INR"],
    ["spend 5000 rupees", 5000, "INR"],
    ["a $300 phone", 300, "USD"],
    ["300 dollars", 300, "USD"],
    ["€49.99 subscription", 49.99, "EUR"],
    ["50 euros", 50, "EUR"],
    ["£20 gift", 20, "GBP"],
    ["20 GBP", 20, "GBP"],
  ])("finds the amount in %j", (message, amount, currency) => {
    expect(findAmounts(message)).toEqual([expect.objectContaining({ amount, currency })]);
  });

  it("finds several amounts in order and ignores plain numbers", () => {
    expect(findAmounts("Should I pay ₹2,000 rent or $50 bill on day 15?").map((a) => [a.amount, a.currency])).toEqual([
      [2000, "INR"],
      [50, "USD"],
    ]);
    expect(findAmounts("Review my spending this week")).toEqual([]);
    expect(findAmounts("I have 3 credit cards")).toEqual([]);
  });
});

describe("convertAmount", () => {
  it("converts via USD with the demo rates", () => {
    expect(convertAmount(5000, "INR", "USD", rates)).toBe(5988); // $59.88
    expect(convertAmount(5000, "INR", "EUR", rates)).toBe(5509); // €55.09
    expect(convertAmount(50, "EUR", "USD", rates)).toBe(5435); // $54.35
    expect(convertAmount(300, "USD", "INR", rates)).toBe(2505000); // ₹25,050.00
  });
});

describe("currencyHints", () => {
  it("explains ₹5,000 in USD so the AI can't mistake it for $5,000", () => {
    expect(currencyHints("Can I afford a ₹5,000 purchase?", "USD", rates)).toEqual([
      '"₹5,000" means ₹5,000.00 (INR) = $59.88 USD.',
    ]);
  });

  it("adds the display currency when it differs from USD and the source", () => {
    expect(currencyHints("Can I afford a ₹5,000 purchase?", "EUR", rates)).toEqual([
      '"₹5,000" means ₹5,000.00 (INR) = $59.88 USD = €55.09 EUR.',
    ]);
  });

  it("converts dollar amounts to rupees for an INR user", () => {
    expect(currencyHints("a $300 phone", "INR", rates)).toEqual(['"$300" means $300.00 (USD) = ₹25,050.00 INR.']);
  });

  it("returns nothing when there are no amounts, or nothing needs converting", () => {
    expect(currencyHints("How do I pay off my debt faster?", "USD", rates)).toEqual([]);
    expect(currencyHints("Can I afford a $300 phone?", "USD", rates)).toEqual([]);
  });
});
