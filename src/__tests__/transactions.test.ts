import { describe, expect, it, vi } from "vitest";
import {
  buildSampleTransactions,
  MOCK_OPENING_BALANCE_CENTS,
  mockTransactions,
  type Transaction,
} from "@/data/mockTransactions";
import { calculateBalanceCents } from "@/lib/balance";
import { dailySpending, monthTotals } from "@/lib/insights";
import {
  assertUserId,
  getFinancialData,
  seedSampleData,
  todayIso,
  type NewTransaction,
  type TransactionStore,
} from "@/lib/server/transactions";

const USER_A = "64b0000000000000000000aa";
const USER_B = "64b0000000000000000000bb";

/** In-memory MongoDB stand-in that keeps each user's rows separate. */
function memoryStore() {
  const rows = new Map<string, Transaction[]>();
  const balances = new Map<string, number>();
  const store: TransactionStore = {
    listByUser: vi.fn(async (userId: string) => [...(rows.get(userId) ?? [])].sort((a, b) => b.date.localeCompare(a.date))),
    countByUser: vi.fn(async (userId: string) => rows.get(userId)?.length ?? 0),
    insertForUser: vi.fn(async (userId: string, txs: NewTransaction[]) => {
      const list = rows.get(userId) ?? [];
      txs.forEach((t, i) => list.push({ ...t, id: `${userId}-${list.length + i}` }));
      rows.set(userId, list);
    }),
    getOpeningBalance: vi.fn(async (userId: string) => balances.get(userId) ?? 0),
    setOpeningBalance: vi.fn(async (userId: string, cents: number) => void balances.set(userId, cents)),
  };
  return { store, rows };
}

describe("buildSampleTransactions", () => {
  it("re-dates the 10 sample transactions so the latest falls on the given day", () => {
    const sample = buildSampleTransactions("2026-12-20");
    expect(sample).toHaveLength(10);
    expect(sample[0]).toEqual({ merchant: "Green Basket Grocery", category: "groceries", amountCents: -8423, date: "2026-12-20" });
    expect(sample.map((t) => t.date).sort().at(0)).toBe("2026-12-09"); // rent was 11 days before the latest
    expect(calculateBalanceCents(sample.map((t, i) => ({ ...t, id: String(i) })))).toBe(208254); // same net total
  });

  it("keeps the last 7 days of spending identical to the original mock data", () => {
    const sample = buildSampleTransactions("2027-03-15").map((t, i) => ({ ...t, id: String(i) }));
    expect(dailySpending(sample, "2027-03-15", 7).map((d) => d.spendingCents)).toEqual(
      dailySpending(mockTransactions, "2026-11-12", 7).map((d) => d.spendingCents),
    );
  });

  it("rejects invalid dates", () => {
    expect(() => buildSampleTransactions("15/03/2027")).toThrow();
  });
});

describe("seedSampleData", () => {
  it("gives a new user 10 transactions and the sample opening balance", async () => {
    const { store, rows } = memoryStore();
    expect(await seedSampleData(USER_A, store, "2026-11-14")).toEqual({ created: true, count: 10 });
    expect(rows.get(USER_A)).toHaveLength(10);
    expect(store.setOpeningBalance).toHaveBeenCalledWith(USER_A, MOCK_OPENING_BALANCE_CENTS);
  });

  it("never creates duplicates for a user who already has data", async () => {
    const { store, rows } = memoryStore();
    await seedSampleData(USER_A, store, "2026-11-14");
    expect(await seedSampleData(USER_A, store, "2026-11-14")).toEqual({ created: false, count: 0 });
    expect(rows.get(USER_A)).toHaveLength(10);
  });

  it("rejects invalid user ids", async () => {
    const { store } = memoryStore();
    await expect(seedSampleData("not-an-id", store)).rejects.toThrow("Invalid user id");
    await expect(seedSampleData("", store)).rejects.toThrow();
    expect(store.insertForUser).not.toHaveBeenCalled();
  });
});

describe("getFinancialData", () => {
  it("returns only the requested user's transactions and balance", async () => {
    const { store } = memoryStore();
    await seedSampleData(USER_A, store, "2026-11-14");
    await store.insertForUser(USER_B, [{ merchant: "Asha Bakery", category: "income", amountCents: 50000, date: "2026-11-13" }]);

    const a = await getFinancialData(USER_A, store, "2026-11-14");
    const b = await getFinancialData(USER_B, store, "2026-11-14");
    expect(a.transactions).toHaveLength(10);
    expect(a.transactions.some((t) => t.merchant === "Asha Bakery")).toBe(false);
    expect(b.transactions.map((t) => t.merchant)).toEqual(["Asha Bakery"]);
    expect(b.openingBalanceCents).toBe(0);
    expect(store.listByUser).toHaveBeenCalledWith(USER_A);
    expect(store.listByUser).toHaveBeenCalledWith(USER_B);
  });

  it("calculates totals dynamically from the user's data", async () => {
    const { store } = memoryStore();
    await seedSampleData(USER_A, store, "2026-11-20");
    const data = await getFinancialData(USER_A, store, "2026-11-20");
    expect(data.asOf).toBe("2026-11-20");
    expect(data.openingBalanceCents + calculateBalanceCents(data.transactions)).toBe(1492254); // $14,922.54
    expect(monthTotals(data.transactions, data.asOf)).toEqual({ incomeCents: 385000, expensesCents: 176746 });
  });

  it("returns an empty list for a user with no data", async () => {
    const { store } = memoryStore();
    expect(await getFinancialData(USER_A, store, "2026-11-14")).toEqual({
      transactions: [],
      openingBalanceCents: 0,
      asOf: "2026-11-14",
    });
  });
});

describe("helpers", () => {
  it("todayIso gives a YYYY-MM-DD date in UTC", () => {
    expect(todayIso(new Date("2026-11-14T23:30:00Z"))).toBe("2026-11-14");
  });

  it("assertUserId accepts MongoDB ids only", () => {
    expect(() => assertUserId(USER_A)).not.toThrow();
    for (const bad of ["", "123", "zzzzzzzzzzzzzzzzzzzzzzzz", null, 42, { $ne: null }]) {
      expect(() => assertUserId(bad)).toThrow();
    }
  });
});
