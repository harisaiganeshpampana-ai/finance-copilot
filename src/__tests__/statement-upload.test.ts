import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrencyCode } from "@/lib/currency";
import type { Provider } from "@/lib/server/copilot";
import { StatementError, type StatementRow } from "@/lib/server/statement-parser";
import { importStatement, safeFileName, StatementConflictError, type StatementStore } from "@/lib/server/statement-upload";
import { CANARA_CSV } from "./fixtures/canara-statement";

const USER = "64b0000000000000000000aa";
const NOW = new Date("2026-11-14T12:00:00Z");
const bytes = (text: string) => new TextEncoder().encode(text);
const file = (text: string, extra: { name?: string; currency?: CurrencyCode } = {}) => ({ name: extra.name ?? "a.csv", bytes: bytes(text), currency: extra.currency });
const NO_AI: Provider[] = [];

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
    getProfile: vi.fn(async () => ({ currency: state.currency, otherRows: state.otherRows, uploadedRows: uploaded.size })),
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
  const deps = () => ({ store: mem.store, providers: NO_AI, now: NOW });
  beforeEach(() => {
    mem = memoryStore({ sampleRows: 10 });
  });

  it("saves the transactions in the statement's currency, replaces sample data and records the statement", async () => {
    const res = await importStatement(USER, file(CANARA_CSV, { name: "Canara Oct.csv" }), deps());
    expect(res).toEqual({
      imported: 9,
      alreadyUploaded: 0,
      skipped: 4,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-28",
      moneyInMinor: 85_000_00,
      moneyOutMinor: 35_289_50,
      currency: "INR", // detected from IFSC / UPI / NEFT
      bank: "Canara Bank",
      method: "reader",
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
    await importStatement(USER, file(CANARA_CSV), deps());
    const sum = [...mem.uploaded.values()].reduce((s, r) => s + r.amountMinor, 0);
    expect(mem.state.openingBalanceMinor + sum).toBe(67_210_50);
    expect(mem.state.openingBalanceMinor).toBe(17_500_00); // the statement's opening balance
  });

  it("uploading the same statement again adds nothing new", async () => {
    await importStatement(USER, file(CANARA_CSV), deps());
    const again = await importStatement(USER, file(CANARA_CSV), deps());
    expect(again).toMatchObject({ imported: 0, alreadyUploaded: 9 });
    expect(mem.uploaded.size).toBe(9);
    expect(mem.state.openingBalanceMinor).toBe(17_500_00);
  });

  it("reads a US statement in dollars with month-first dates", async () => {
    const us = ["Chase Total Checking", "Posting Date,Description,Amount,Balance", "10/28/2026,STARBUCKS #123,-6.45,1993.55", "10/02/2026,PAYROLL ACME INC,2000.00,2000.00"].join("\n");
    const res = await importStatement(USER, file(us), deps());
    expect(res).toMatchObject({ currency: "USD", bank: "Chase", periodStart: "2026-10-02", periodEnd: "2026-10-28" });
    expect(mem.state.currency).toBe("USD");
  });

  it("reads a European statement with decimal commas", async () => {
    const eu = ["Buchungstag;Description;Amount;Balance", "28.10.2026;REWE SAGT DANKE;-1.234,56 EUR;8.765,44", "01.10.2026;GEHALT;10.000,00 EUR;10.000,00"].join("\n");
    const res = await importStatement(USER, file(eu), deps());
    expect(res).toMatchObject({ currency: "EUR", moneyOutMinor: 123_456, moneyInMinor: 1_000_000 });
  });

  it("asks for the currency when it can't be detected, and accepts the user's choice", async () => {
    const plain = "Date,Description,Amount\n01-10-2026,COFFEE,-100";
    const err = await importStatement(USER, file(plain), deps()).catch((e) => e);
    expect(err).toBeInstanceOf(StatementError);
    expect(err.code).toBe("currency_required");
    expect(mem.store.saveRows).not.toHaveBeenCalled();
    await expect(importStatement(USER, file(plain, { currency: "GBP" }), deps())).resolves.toMatchObject({ currency: "GBP" });
  });

  it("explains unsupported currencies", async () => {
    const aed = ["Date,Description,Amount", "01-10-2026,CARREFOUR AED,-100 AED", "02-10-2026,SALARY AED,5000 AED", "03-10-2026,ENOC AED,-50 AED"].join("\n");
    const err = await importStatement(USER, file(aed), deps()).catch((e) => e);
    expect(err.code).toBe("unsupported_currency");
    expect(err.message).toMatch(/AED/);
  });

  it("refuses to mix currencies in one account", async () => {
    await importStatement(USER, file(CANARA_CSV), deps());
    const us = "Date,Description,Amount\n10/28/2026,STARBUCKS,-$6.45\n10/29/2026,DELI,-$5.00";
    const err = await importStatement(USER, file(us), deps()).catch((e) => e);
    expect(err).toBeInstanceOf(StatementConflictError);
    expect(err.message).toMatch(/INR.*USD/);
    const other = memoryStore({ currency: "USD", otherRows: 5 });
    await expect(importStatement(USER, file(CANARA_CSV), { store: other.store, providers: NO_AI })).rejects.toBeInstanceOf(StatementConflictError);
  });

  it("uses the AI fallback for layouts the reader can't understand", async () => {
    const odd = "Account summary\nOn 3 Oct 2026 you paid Rs 450.50 to Swiggy. On 1 Oct 2026 you received Rs 85,000.00 salary from Acme. IFSC CNRB0001234";
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                bank: "Canara Bank",
                currency: "INR",
                transactions: [
                  { date: "2026-10-01", description: "Salary from Acme", amount: 85000, balance: null },
                  { date: "2026-10-03", description: "Swiggy", amount: -450.5, balance: null },
                ],
              }),
            },
          },
        ],
      }),
    );
    const providers: Provider[] = [{ name: "gemini", url: "https://ai.example/v1", model: "m", apiKey: "k" }];
    const res = await importStatement(USER, file(odd, { name: "odd.txt" }), { store: mem.store, providers, fetchImpl: fetchImpl as unknown as typeof fetch, now: NOW });
    expect(res).toMatchObject({ method: "ai", imported: 2, currency: "INR", moneyOutMinor: 45_050 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("explains when nothing can read the statement (no AI configured)", async () => {
    await expect(importStatement(USER, file("hello there"), deps())).rejects.toThrow(/couldn't read the transactions/);
    expect(mem.store.getProfile).not.toHaveBeenCalled();
  });

  it("rejects invalid user ids", async () => {
    await expect(importStatement("nope", file(CANARA_CSV), deps())).rejects.toThrow(/invalid user id/i);
  });
});

describe("safeFileName", () => {
  it("keeps only a clean base name", () => {
    expect(safeFileName("C:\\Users\\me\\Canara Oct (1).pdf")).toBe("Canara Oct (1).pdf");
    expect(safeFileName("../../etc/passwd<script>.csv")).toBe("passwdscript.csv");
    expect(safeFileName(undefined)).toBe("statement");
    expect(safeFileName("x".repeat(500) + ".csv")).toHaveLength(120);
  });
});
