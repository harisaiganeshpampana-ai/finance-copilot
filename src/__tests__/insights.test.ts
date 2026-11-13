import { describe, expect, it } from "vitest";
import { MOCK_AS_OF, MOCK_OPENING_BALANCE_CENTS, mockTransactions, type Transaction } from "@/data/mockTransactions";
import { dailySpending, formatPercent, monthTotals, percentChange, totalBalanceCents } from "@/lib/insights";

const tx = (date: string, amountCents: number): Transaction => ({
  id: `${date}-${amountCents}`,
  date,
  merchant: "Test",
  category: amountCents > 0 ? "income" : "shopping",
  amountCents,
});

describe("totalBalanceCents", () => {
  it("adds the opening balance to the net of all transactions", () => {
    expect(totalBalanceCents(100000, [tx("2026-11-01", 5000), tx("2026-11-02", -2500)])).toBe(102500);
  });

  it("matches the mock account ($12,840.00 + $2,082.54 = $14,922.54)", () => {
    expect(totalBalanceCents(MOCK_OPENING_BALANCE_CENTS, mockTransactions)).toBe(1492254);
  });

  it("rejects an opening balance that is not whole cents", () => {
    expect(() => totalBalanceCents(10.5, [])).toThrow();
  });
});

describe("percentChange and formatPercent", () => {
  it("computes the mock balance trend as +16.2%", () => {
    const change = percentChange(MOCK_OPENING_BALANCE_CENTS, 1492254);
    expect(change).not.toBeNull();
    expect(formatPercent(change!)).toBe("+16.2%");
  });

  it("handles decreases, no change, and a zero starting value", () => {
    expect(percentChange(200, 150)).toBe(-25);
    expect(percentChange(200, 200)).toBe(0);
    expect(percentChange(0, 500)).toBeNull();
  });

  it("formats with a sign and one decimal place", () => {
    expect(formatPercent(2.5)).toBe("+2.5%");
    expect(formatPercent(-3.04)).toBe("-3.0%");
    expect(formatPercent(0)).toBe("0.0%");
    expect(formatPercent(-0.04)).toBe("0.0%");
  });
});

describe("monthTotals", () => {
  it("returns this month's income and expenses for the mock data", () => {
    expect(monthTotals(mockTransactions, MOCK_AS_OF)).toEqual({ incomeCents: 385000, expensesCents: 176746 });
  });

  it("ignores other months and dates after the as-of date", () => {
    const data = [tx("2026-10-31", -9999), tx("2026-11-05", 1000), tx("2026-11-06", -400), tx("2026-11-20", -5000)];
    expect(monthTotals(data, "2026-11-12")).toEqual({ incomeCents: 1000, expensesCents: 400 });
  });

  it("rejects an invalid date", () => {
    expect(() => monthTotals([], "12/11/2026")).toThrow();
  });
});

describe("dailySpending", () => {
  it("returns spending for each of the last 7 days, oldest first", () => {
    const series = dailySpending(mockTransactions, MOCK_AS_OF, 7);
    expect(series.map((d) => d.date)).toEqual([
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
    // Nov 8 has payroll income too; only the $32.99 purchase counts as spending.
    expect(series.map((d) => d.spendingCents)).toEqual([1850, 675, 3299, 11240, 4710, 1549, 8423]);
    expect(series.reduce((s, d) => s + d.spendingCents, 0)).toBe(31746);
  });

  it("fills days with no spending with 0 and crosses month boundaries", () => {
    expect(dailySpending(mockTransactions, "2026-11-02", 3)).toEqual([
      { date: "2026-10-31", spendingCents: 0 },
      { date: "2026-11-01", spendingCents: 145000 },
      { date: "2026-11-02", spendingCents: 0 },
    ]);
  });

  it("rejects invalid inputs", () => {
    expect(() => dailySpending([], "2026-13-01")).toThrow();
    expect(() => dailySpending([], MOCK_AS_OF, 0)).toThrow();
  });
});
