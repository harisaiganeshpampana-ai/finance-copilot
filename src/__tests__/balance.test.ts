import { describe, expect, it } from "vitest";
import { mockTransactions, type Transaction } from "@/data/mockTransactions";
import { calculateBalanceCents, formatCents } from "@/lib/balance";

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
