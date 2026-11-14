import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrencyCode } from "@/lib/currency";
import { StatementError, type StatementRow } from "@/lib/server/statement-csv";
import { importStatement, safeFileName, StatementConflictError, type StatementStore } from "@/lib/server/statement-upload";
import { CANARA_CSV } from "./fixtures/canara-statement";

const USER = "64b0000000000000000000aa";
const NOW = new Date("2026-11-14T12:00:00Z");

/** In-memory version of the MongoDB store for one user. */
function memoryStore(init: { currency?: CurrencyCode; sampleRows?: number; otherRows?: number } = {}) {
  const uploaded = new Map<string, StatementRow>();
  const state = {
    currency: init.currency ?? ("USD" as CurrencyCode),
    sampleRows: init.sampleRows ?? 0,
    otherRows: init.otherRows ?? 0,
    openingBalanceMinor: 1_284_000,
    statement: null as unknown,
  };
  const store: StatementStore = {
    getProfile: vi.fn(async () => ({ currency: state.currency, otherRows: state.otherRows })),
    saveRows: vi.fn(async (_u: string, rows: StatementRow[]) => {
      state.sampleRows = 0;
      let inserted = 0;
      for (const r of rows) {
        if (!uploaded.has(r.externalId)) inserted++;
        uploaded.set(r.externalId, r);
      }
      return { inserted };
    }),
    sumUploaded: vi.fn(async () => [...uploaded.values()].reduce((s, r) => s + r.amountMinor, 0)),
    saveProfile: vi.fn(async (_u: string, p) => {
      state.currency = p.currency;
      state.statement = p.statement;
      if (p.openingBalanceMinor !== undefined) state.openingBalanceMinor = p.openingBalanceMinor;
    }),
  };
  return { store, state, uploaded };
}

afterEach(() => vi.restoreAllMocks());

describe("importing a statement", () => {
  let mem: ReturnType<typeof memoryStore>;
  beforeEach(() => {
    mem = memoryStore({ sampleRows: 10 });
  });

  it("saves the transactions in rupees, replaces sample data and records the statement", async () => {
    const res = await importStatement(USER, { name: "Canara Oct.csv", text: CANARA_CSV }, mem.store, NOW);
    expect(res).toEqual({
      imported: 9,
      alreadyUploaded: 0,
      skipped: 4,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-28",
      moneyInMinor: 85_000_00,
      moneyOutMinor: 35_289_50,
      currency: "INR",
    });
    expect(mem.state.sampleRows).toBe(0);
    expect(mem.state.currency).toBe("INR");
    expect(mem.state.statement).toEqual({
      bank: "Canara Bank",
      fileName: "Canara Oct.csv",
      uploadedAt: NOW.toISOString(),
      periodStart: "2026-10-01",
      periodEnd: "2026-10-28",
    });
  });

  it("sets the opening balance so the app's balance equals the statement's closing balance", async () => {
    await importStatement(USER, { name: "a.csv", text: CANARA_CSV }, mem.store, NOW);
    const sum = [...mem.uploaded.values()].reduce((s, r) => s + r.amountMinor, 0);
    expect(mem.state.openingBalanceMinor + sum).toBe(67_210_50);
    expect(mem.state.openingBalanceMinor).toBe(17_500_00); // the statement's opening balance
  });

  it("uploading the same statement again adds nothing new", async () => {
    await importStatement(USER, { name: "a.csv", text: CANARA_CSV }, mem.store, NOW);
    const again = await importStatement(USER, { name: "a.csv", text: CANARA_CSV }, mem.store, NOW);
    expect(again).toMatchObject({ imported: 0, alreadyUploaded: 9 });
    expect(mem.uploaded.size).toBe(9);
    expect(mem.state.openingBalanceMinor).toBe(17_500_00);
  });

  it("resets the old (dollar) opening balance when the statement has no balance column", async () => {
    await importStatement(USER, { name: "a.csv", text: "Date,Description,Amount\n01-10-2026,UBER,-100" }, mem.store, NOW);
    expect(mem.state.openingBalanceMinor).toBe(0);
  });

  it("refuses to mix rupees into real data in another currency", async () => {
    const other = memoryStore({ currency: "USD", otherRows: 5 });
    await expect(importStatement(USER, { name: "a.csv", text: CANARA_CSV }, other.store, NOW)).rejects.toBeInstanceOf(StatementConflictError);
    expect(other.store.saveRows).not.toHaveBeenCalled();
  });

  it("validates the file before touching the database", async () => {
    await expect(importStatement(USER, { name: "a.csv", text: "hello" }, mem.store, NOW)).rejects.toBeInstanceOf(StatementError);
    expect(mem.store.getProfile).not.toHaveBeenCalled();
    expect(mem.store.saveRows).not.toHaveBeenCalled();
  });

  it("rejects invalid user ids", async () => {
    await expect(importStatement("nope", { name: "a.csv", text: CANARA_CSV }, mem.store)).rejects.toThrow(/invalid user id/i);
  });
});

describe("safeFileName", () => {
  it("keeps only a clean base name", () => {
    expect(safeFileName("C:\\Users\\me\\Canara Oct (1).csv")).toBe("Canara Oct (1).csv");
    expect(safeFileName("../../etc/passwd<script>.csv")).toBe("passwdscript.csv");
    expect(safeFileName(undefined)).toBe("statement.csv");
    expect(safeFileName("x".repeat(500) + ".csv")).toHaveLength(120);
  });
});
