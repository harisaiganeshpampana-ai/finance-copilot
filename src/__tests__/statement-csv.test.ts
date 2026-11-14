import { describe, expect, it } from "vitest";
import {
  categorize,
  MAX_STATEMENT_ROWS,
  merchantFromDescription,
  parseAmount,
  parseStatementCsv,
  parseStatementDate,
  StatementError,
} from "@/lib/server/statement-csv";
import { CANARA_CSV } from "./fixtures/canara-statement";

describe("Canara Bank statement CSV", () => {
  const parsed = parseStatementCsv(CANARA_CSV);

  it("finds the table below the account details and reads every transaction", () => {
    expect(parsed.rows).toHaveLength(9);
    expect(parsed.skipped).toBe(4); // opening balance, closing balance, total, footer note
    expect(parsed.periodStart).toBe("2026-10-01");
    expect(parsed.periodEnd).toBe("2026-10-28");
  });

  it("maps Date, Description and Amount (Debit = money out, Credit = money in) in exact paise", () => {
    expect(parsed.rows[0]).toMatchObject({
      date: "2026-10-01",
      merchant: "Acme Technologies",
      description: "UPI/CR/427512345678/ACME TECHNOLOGIES/HDFC/acme@hdfc/Salary",
      category: "income",
      amountMinor: 8_500_000,
      balanceMinor: 10_250_000,
    });
    expect(parsed.rows[2]).toMatchObject({ merchant: "Swiggy", category: "dining", amountMinor: -45_050 });
  });

  it("totals match the statement's own Total line", () => {
    const out = parsed.rows.filter((r) => r.amountMinor < 0).reduce((s, r) => s - r.amountMinor, 0);
    const inn = parsed.rows.filter((r) => r.amountMinor > 0).reduce((s, r) => s + r.amountMinor, 0);
    expect(out).toBe(25_000_00 + 450_50 + 2_310_00 + 649_00 + 20_00 + 20_00 + 1_840_00 + 5_000_00);
    expect(inn).toBe(85_000_00);
    expect(parsed.closingBalanceMinor).toBe(67_210_50);
  });

  it("sorts spending into categories", () => {
    const byMerchant = Object.fromEntries(parsed.rows.map((r) => [r.merchant, r.category]));
    expect(byMerchant).toMatchObject({
      Swiggy: "dining",
      Bigbasket: "groceries",
      Netflix: "subscriptions",
      "Chai Point": "other",
      "BESCOM ELECTRICITY BILL PAYMENT": "utilities",
      "ATM CASH WITHDRAWAL MG ROAD": "other",
    });
    expect(parsed.rows[1].category).toBe("housing"); // NEFT ... RENT
  });

  it("gives identical rows (two ₹20 teas) separate, stable fingerprints", () => {
    const teas = parsed.rows.filter((r) => r.merchant === "Chai Point");
    expect(teas).toHaveLength(2);
    expect(teas[0].externalId).not.toBe(teas[1].externalId);
    expect(new Set(parsed.rows.map((r) => r.externalId)).size).toBe(9);
    // Uploading the same file again produces the same fingerprints (so no duplicates).
    expect(parseStatementCsv(CANARA_CSV).rows.map((r) => r.externalId)).toEqual(parsed.rows.map((r) => r.externalId));
  });

  it("handles newest-first exports", () => {
    const [head, ...rest] = CANARA_CSV.split("\n").slice(5, 16);
    const reversed = [head, ...rest.reverse()].join("\n");
    const res = parseStatementCsv(reversed);
    expect(res.rows[0].date).toBe("2026-10-01");
    expect(res.closingBalanceMinor).toBe(67_210_50);
  });
});

describe("other statement layouts", () => {
  it("accepts a single Amount column with a Dr/Cr column", () => {
    const csv = ["Date,Particulars,Amount,Dr/Cr,Balance", "03/11/2026,ZOMATO ORDER,350.00,DR,9650.00", "04/11/2026,REFUND,100,CR,9750.00"].join("\n");
    const res = parseStatementCsv(csv);
    expect(res.rows.map((r) => r.amountMinor)).toEqual([-35_000, 10_000]);
    expect(res.rows[0].category).toBe("dining");
  });

  it("accepts Dr/Cr suffixes and minus signs in the Amount column", () => {
    const csv = ["Transaction Date,Narration,Amount", "05 Nov 2026,UBER TRIP,250.00 Dr", "06-Nov-2026,INTEREST,12.5 Cr", "07-11-26,PETROL HPCL,-1500"].join("\n");
    const res = parseStatementCsv(csv);
    expect(res.rows.map((r) => [r.date, r.amountMinor, r.category])).toEqual([
      ["2026-11-05", -25_000, "transport"],
      ["2026-11-06", 1_250, "income"],
      ["2026-11-07", -150_000, "transport"],
    ]);
    expect(res.closingBalanceMinor).toBeNull();
  });

  it("accepts Withdrawals / Deposits headers and a byte-order mark", () => {
    const csv = "﻿Date,Description,Withdrawals,Deposits,Balance\n2026-11-01,AMAZON PAY,999,,1000\n";
    expect(parseStatementCsv(csv).rows[0]).toMatchObject({ amountMinor: -99_900, category: "shopping" });
  });
});

describe("rejecting bad files (server-side validation)", () => {
  it("explains when there's no transaction table", () => {
    expect(() => parseStatementCsv("name,email\nA,a@example.com")).toThrow(StatementError);
    expect(() => parseStatementCsv("name,email\nA,a@example.com")).toThrow(/Date, Description and Amount/);
  });

  it("rejects empty and binary files", () => {
    expect(() => parseStatementCsv("   ")).toThrow(/empty/);
    expect(() => parseStatementCsv("PK\u0003\u0004\u0000\u0000xlsx")).toThrow(/CSV/);
  });

  it("rejects a table with no usable rows", () => {
    expect(() => parseStatementCsv("Date,Description,Debit,Credit\nnot a date,Hello,1,\n")).toThrow(/no transactions/);
  });

  it("caps the number of rows", () => {
    const rows = Array.from({ length: MAX_STATEMENT_ROWS + 1 }, () => "01-10-2026,X,1,");
    expect(() => parseStatementCsv(["Date,Description,Debit,Credit", ...rows].join("\n"))).toThrow(/more than/);
  });

  it("skips rows with ambiguous or malformed amounts instead of guessing", () => {
    const csv = ["Date,Description,Debit,Credit", "01-10-2026,BOTH,10,20", "02-10-2026,WORDS,ten,", "03-10-2026,OK,5,"].join("\n");
    const res = parseStatementCsv(csv);
    expect(res.rows.map((r) => r.description)).toEqual(["OK"]);
    expect(res.skipped).toBe(2);
  });

  it("cleans control characters and limits description length", () => {
    const csv = `Date,Description,Debit,Credit\n01-10-2026,"A\u0007B   ${"x".repeat(400)}",1,\n`;
    const row = parseStatementCsv(csv).rows[0];
    expect(row.description.startsWith("A B x")).toBe(true);
    expect(row.description.length).toBe(300);
    expect(row.merchant.length).toBeLessThanOrEqual(60);
  });
});

describe("value parsing", () => {
  it("parses Indian amounts with integer math", () => {
    expect(parseAmount("1,23,456.78")).toEqual({ minor: 12_345_678, drCr: null });
    expect(parseAmount("₹ 500")).toEqual({ minor: 50_000, drCr: null });
    expect(parseAmount("Rs.0.1")).toEqual({ minor: 10, drCr: null });
    expect(parseAmount("(250.00)")).toEqual({ minor: -25_000, drCr: null });
    expect(parseAmount("500.00 Dr")).toEqual({ minor: 50_000, drCr: "dr" });
    for (const bad of ["", "-", "abc", "1.234", "1e5", "12.3.4", undefined, 5]) expect(parseAmount(bad)).toBeNull();
  });

  it("parses day-first dates and rejects impossible ones", () => {
    expect(parseStatementDate("05-04-2026")).toBe("2026-04-05");
    expect(parseStatementDate("05/04/26")).toBe("2026-04-05");
    expect(parseStatementDate("5 April 2026")).toBe("2026-04-05");
    expect(parseStatementDate("05-Sep-2026 10:15:22 AM")).toBe("2026-09-05");
    expect(parseStatementDate("2026-04-05")).toBe("2026-04-05");
    for (const bad of ["31-02-2026", "13/13/2026", "Opening Balance", "", undefined]) expect(parseStatementDate(bad)).toBeNull();
  });

  it("extracts readable merchant names", () => {
    expect(merchantFromDescription("UPI/DR/123/MY KIRANA STORE/SBIN/x@sbi/note")).toBe("My Kirana Store");
    expect(merchantFromDescription("NEFT-HDFC0000123-SHARMA PROPERTIES-RENT")).toBe("NEFT Sharma Properties");
    expect(merchantFromDescription("CASH DEPOSIT")).toBe("CASH DEPOSIT");
  });

  it("only treats money in as income", () => {
    expect(categorize("SWIGGY", true)).toBe("income");
    expect(categorize("MONTHLY RENT", false)).toBe("housing");
    expect(categorize("SOMETHING ELSE", false)).toBe("other");
  });
});
