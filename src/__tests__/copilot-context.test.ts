import { describe, expect, it } from "vitest";
import { MOCK_AS_OF, mockTransactions, type Transaction } from "@/data/mockTransactions";
import { addOneMonth, estimateUpcomingBills } from "@/lib/insights";
import {
  affordabilityNotes,
  buildFinancialContext,
  buildSystemPrompt,
  buildUserPrompt,
  formatFinancialContext,
} from "@/lib/server/copilot";

const tx = (date: string, merchant: string, category: Transaction["category"], amountCents: number): Transaction => ({
  id: `${date}-${merchant}`,
  date,
  merchant,
  category,
  amountCents,
});

describe("addOneMonth", () => {
  it.each([
    ["2026-11-01", "2026-12-01"],
    ["2026-12-15", "2027-01-15"],
    ["2026-01-31", "2026-02-28"],
    ["2028-01-31", "2028-02-29"],
    ["2026-03-31", "2026-04-30"],
  ])("%s -> %s", (from, to) => expect(addOneMonth(from)).toBe(to));
});

describe("estimateUpcomingBills", () => {
  it("projects rent, utilities and subscriptions one month ahead for the mock data", () => {
    expect(estimateUpcomingBills(mockTransactions, MOCK_AS_OF, 30)).toEqual([
      { merchant: "Oakwood Apartments Rent", category: "housing", expectedDate: "2026-12-01", amountCents: 145000 },
      { merchant: "City Power & Light", category: "utilities", expectedDate: "2026-12-09", amountCents: 11240 },
      { merchant: "StreamBox Subscription", category: "subscriptions", expectedDate: "2026-12-11", amountCents: 1549 },
    ]);
  });

  it("ignores non-recurring spending, income, future-dated items and bills beyond the horizon", () => {
    const data = [
      tx("2026-11-05", "Grocer", "groceries", -5000),
      tx("2026-11-05", "Payroll", "income", 500000),
      tx("2026-11-20", "Future Rent", "housing", -100000), // after as-of date
      tx("2026-11-02", "Power", "utilities", -9000), // due 2026-12-02 (20 days)
    ];
    expect(estimateUpcomingBills(data, "2026-11-12", 10)).toEqual([]);
    expect(estimateUpcomingBills(data, "2026-11-12", 30).map((b) => b.merchant)).toEqual(["Power"]);
  });

  it("uses only the latest occurrence of each recurring merchant", () => {
    const data = [tx("2026-10-01", "Rent", "housing", -100000), tx("2026-11-01", "Rent", "housing", -110000)];
    expect(estimateUpcomingBills(data, "2026-11-12", 30)).toEqual([
      { merchant: "Rent", category: "housing", expectedDate: "2026-12-01", amountCents: 110000 },
    ]);
  });
});

describe("buildFinancialContext", () => {
  const ctx = buildFinancialContext();

  it("includes calculated Total Income, Total Expenses and Current Balance", () => {
    expect(ctx.summary).toEqual({
      currentBalance: 14922.54,
      totalIncome: 3850,
      totalExpenses: 1767.46,
      netCashFlow: 2082.54,
      openingBalance: 12840,
      period: "2026-11-01 to 2026-11-12",
    });
  });

  it("includes upcoming expenses and the balance after them", () => {
    expect(ctx.upcomingExpenses.items.map((i) => [i.merchant, i.expectedDate, i.amount])).toEqual([
      ["Oakwood Apartments Rent", "2026-12-01", 1450],
      ["City Power & Light", "2026-12-09", 112.4],
      ["StreamBox Subscription", "2026-12-11", 15.49],
    ]);
    expect(ctx.upcomingExpenses.total).toBe(1577.89);
    expect(ctx.balanceAfterUpcomingExpenses).toBe(13344.65); // 14,922.54 - 1,577.89
  });

  it("includes every transaction with numeric dollar amounts", () => {
    expect(ctx.transactions).toHaveLength(10);
    expect(ctx.transactions).toContainEqual({
      date: "2026-11-08",
      merchant: "Acme Corp Payroll",
      category: "income",
      amount: 3250,
    });
    expect(ctx.spendingLast7Days).toHaveLength(7);
  });

  it("formats as clean JSON that parses back to the same data", () => {
    const json = formatFinancialContext(ctx);
    expect(JSON.parse(json)).toEqual(ctx);
    expect(json).toContain('\n  "summary": {'); // pretty-printed
  });
});

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt("USD");

  it.each([
    "You are CalmOwe, an expert AI financial copilot.",
    "You must base every answer strictly on the provided transaction data.",
    "Do not make up numbers.",
    "If the data is insufficient, state that clearly.",
    "calculate their current balance minus the cost, and factor in upcoming expenses",
    "Do not provide investment advice.",
  ])("contains %j", (text) => expect(prompt).toContain(text));

  it("uses the selected display currency", () => {
    expect(buildSystemPrompt("INR")).toContain("Show money amounts in INR");
    expect(buildSystemPrompt("GBP")).toContain("1 USD = 0.79 GBP");
  });
});

describe("buildUserPrompt", () => {
  it("injects the JSON data before the question", () => {
    const prompt = buildUserPrompt("How can I spend less on dining?", "USD");
    const match = prompt.match(/^Here is my current financial data:\n([\s\S]+)\n\nMy question is: (.+)$/);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toEqual(buildFinancialContext());
    expect(match![2]).toBe("How can I spend less on dining?");
  });

  it("appends exact conversions and affordability math for foreign-currency amounts", () => {
    const prompt = buildUserPrompt("Can I afford a ₹5,000 purchase?", "USD");
    expect(prompt).toContain("My question is: Can I afford a ₹5,000 purchase?");
    expect(prompt).toContain("[Exact figures computed by CalmOwe; use these exactly and do not recalculate:");
    expect(prompt).toContain('"₹5,000" means ₹5,000.00 (INR) = $59.88 USD.');
    expect(prompt).toContain("minus cost = $14,862.66");
  });

  it("adds nothing extra when the question has no amounts", () => {
    expect(buildUserPrompt("Review my spending this week", "USD").endsWith("My question is: Review my spending this week")).toBe(
      true,
    );
  });
});

describe("affordabilityNotes (server-side math)", () => {
  it("computes balance minus cost, then minus upcoming expenses ($2,000 laptop)", () => {
    expect(affordabilityNotes("Can I afford a $2,000 laptop?", "USD")).toEqual([
      "If spending $2,000 ($2,000.00): current balance $14,922.54 minus cost = $12,922.54; then minus upcoming expenses $1,577.89 = $11,344.65.",
    ]);
  });

  it("converts rupee amounts before subtracting (₹5,000 = $59.88)", () => {
    expect(affordabilityNotes("Can I afford a ₹5,000 purchase?", "USD")).toEqual([
      "If spending ₹5,000 ($59.88): current balance $14,922.54 minus cost = $14,862.66; then minus upcoming expenses $1,577.89 = $13,284.77.",
    ]);
  });

  it("does the math in the user's display currency without rounding drift", () => {
    expect(affordabilityNotes("Can I afford a ₹5,000 purchase?", "INR")).toEqual([
      "If spending ₹5,000 (₹5,000.00): current balance ₹12,46,032.09 minus cost = ₹12,41,032.09; then minus upcoming expenses ₹1,31,753.82 = ₹11,09,278.27.",
    ]);
  });

  it("flags purchases that aren't affordable after upcoming expenses", () => {
    expect(affordabilityNotes("Can I buy a $14,000 car?", "USD")[0]).toBe(
      "If spending $14,000 ($14,000.00): current balance $14,922.54 minus cost = $922.54; then minus upcoming expenses $1,577.89 = -$655.35 (NOT affordable after upcoming expenses).",
    );
  });

  it("returns nothing for questions without amounts", () => {
    expect(affordabilityNotes("How do I pay off my debt faster?", "USD")).toEqual([]);
  });
});
