import { describe, expect, it } from "vitest";
import { mockTransactions, type Transaction } from "@/data/mockTransactions";
import {
  calculateBalanceCents,
  formatCents,
  formatInrPaise,
  USD_TO_INR_DEMO_RATE,
  usdCentsToInrPaise,
} from "@/lib/balance";

const tx = (id: string, amountCents: number): Transaction => ({
  id,
  date: "2026-11-01",
  merchant: "Test Merchant",
  amountCents,
});

describe("calculateBalanceCents", () => {
  it("returns 0 for no transactions", () => {
    expect(calculateBalanceCents([])).toBe(0);
  });

  it("adds income and subtracts spending", () => {
    expect(calculateBalanceCents([tx("a", 10000), tx("b", -2550), tx("c", -1)])).toBe(7449);
  });

  it("can go negative (overdrawn)", () => {
    expect(calculateBalanceCents([tx("a", 500), tx("b", -1500)])).toBe(-1000);
  });

  it("avoids floating-point errors ($0.10 + $0.20 = $0.30 exactly)", () => {
    expect(calculateBalanceCents([tx("a", 10), tx("b", 20)])).toBe(30);
  });

  it("rejects amounts that are not whole cents", () => {
    expect(() => calculateBalanceCents([tx("bad", 12.5)])).toThrow(/bad/);
    expect(() => calculateBalanceCents([tx("nan", Number.NaN)])).toThrow();
  });

  it("matches the expected total for the mock data ($2,082.54)", () => {
    expect(mockTransactions).toHaveLength(10);
    expect(calculateBalanceCents(mockTransactions)).toBe(208254);
  });
});

describe("formatCents", () => {
  it("formats positive and negative amounts as dollars", () => {
    expect(formatCents(208254)).toBe("$2,082.54");
    expect(formatCents(-1549)).toBe("-$15.49");
    expect(formatCents(0)).toBe("$0.00");
  });
});

describe("usdCentsToInrPaise", () => {
  it("uses the demo rate of ₹88 per $1 by default", () => {
    expect(USD_TO_INR_DEMO_RATE).toBe(88);
    expect(usdCentsToInrPaise(100)).toBe(8800); // $1.00 -> ₹88.00
  });

  it("converts the mock balance ($2,082.54 -> ₹1,83,263.52)", () => {
    expect(usdCentsToInrPaise(calculateBalanceCents(mockTransactions))).toBe(18326352);
  });

  it("converts negative amounts", () => {
    expect(usdCentsToInrPaise(-1549)).toBe(-136312);
  });

  it("rounds to the nearest paisa with fractional rates", () => {
    expect(usdCentsToInrPaise(1, 83.4)).toBe(83);
    expect(usdCentsToInrPaise(1, 83.6)).toBe(84);
  });

  it("rejects invalid rates", () => {
    expect(() => usdCentsToInrPaise(100, 0)).toThrow();
    expect(() => usdCentsToInrPaise(100, -5)).toThrow();
    expect(() => usdCentsToInrPaise(100, Number.NaN)).toThrow();
  });
});

describe("formatInrPaise", () => {
  it("formats rupees with Indian digit grouping (lakhs)", () => {
    expect(formatInrPaise(18326352)).toBe("₹1,83,263.52");
    expect(formatInrPaise(-136312)).toBe("-₹1,363.12");
    expect(formatInrPaise(0)).toBe("₹0.00");
  });
});
