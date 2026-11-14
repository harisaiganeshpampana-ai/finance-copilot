import { describe, expect, it } from "vitest";
import { layoutHints, readStatementLines } from "@/lib/server/statement-parser";
import { readStatement } from "@/lib/server/statement-upload";
import { makePdf, type PdfLine } from "./fixtures/make-pdf";

// An SBI-style statement printed as lines, where blank Debit/Credit columns vanish from the
// text, so only the running balance tells money in from money out.
const SBI_TEXT = [
  "State Bank of India  Account Statement",
  "Account Name  MR TEST USER",
  "Txn Date  Value Date  Description  Ref No./Cheque No.  Debit  Credit  Balance",
  "Opening Balance  10,000.00",
  "01 Oct 2026  01 Oct 2026  BY TRANSFER-NEFT ACME PVT LTD SALARY  N123456789  85,000.00  95,000.00",
  "03 Oct 2026  03 Oct 2026  TO TRANSFER-UPI/DR/427598765432/ZOMATO  4275987  650.00  94,350.00",
  "PAYMENT FOR ORDER", // wrapped description
  "05 Oct 2026  05 Oct 2026  ATM WDL ATM CASH 1234 MG ROAD  5,000.00  89,350.00",
  "Closing Balance  89,350.00",
].join("\n");

describe("reading statements line by line", () => {
  it("uses the running balance to tell money in from money out", () => {
    const res = readStatementLines(SBI_TEXT, "INR")!;
    expect(res.transactions.map((t) => [t.date, t.amountMinor, t.balanceMinor])).toEqual([
      ["2026-10-01", 8_500_000, 9_500_000],
      ["2026-10-03", -65_000, 9_435_000],
      ["2026-10-05", -500_000, 8_935_000],
    ]);
    expect(res.transactions[1].description).toBe("TO TRANSFER-UPI/DR/427598765432/ZOMATO 4275987 PAYMENT FOR ORDER");
  });

  it("works for newest-first statements and Dr/Cr markers", () => {
    const newestFirst = ["Date Particulars Amount Balance", "05/10/2026  ATM  5,000.00  89,350.00", "03/10/2026  ZOMATO  650.00  94,350.00", "01/10/2026  SALARY  85,000.00  95,000.00"].join("\n");
    expect(readStatementLines(newestFirst, "INR")!.transactions.map((t) => t.amountMinor)).toEqual([-500_000, -65_000, 8_500_000]);
    const marked = ["10/03/2026  STARBUCKS  6.45 DR", "10/02/2026  PAYROLL  2,000.00 CR"].join("\n");
    expect(readStatementLines(marked, "USD")!.transactions.map((t) => [t.date, t.amountMinor])).toEqual([
      ["2026-10-03", -645],
      ["2026-10-02", 200_000],
    ]);
  });

  it("gives up (so AI can try) when balances don't explain the amounts", () => {
    expect(readStatementLines("01/10/2026 A 10.00 99.00\n02/10/2026 B 20.00 13.00\n03/10/2026 C 30.00 7.00", "INR")).toBeNull();
    expect(readStatementLines("01/10/2026 COFFEE 10.00", "INR")).toBeNull(); // no balance, no sign
    expect(readStatementLines("no dates here at all", "INR")).toBeNull();
  });

  it("is used for PDFs whose columns don't line up", async () => {
    const lines: PdfLine[] = SBI_TEXT.split("\n").map((l) => [[40, l]]);
    const { parsed, bank, currency, method } = await readStatement({ bytes: makePdf([lines]) }, { providers: [] });
    expect({ bank, currency, method }).toEqual({ bank: "State Bank of India", currency: "INR", method: "reader" });
    expect(parsed.rows.map((r) => r.category)).toEqual(["income", "dining", "other"]);
  });
});

describe("PDF headers split over two lines", () => {
  it("stacks them into one header", async () => {
    const pdf = makePdf([
      [
        [[40, "Kotak Mahindra Bank"]],
        [[40, "Date"], [110, "Narration"], [330, "Withdrawal"], [420, "Deposit"], [510, "Balance"]],
        [[330, "(Dr)"], [420, "(Cr)"]],
        [[40, "02-10-2026"], [110, "BIGBASKET ORDER"], [335, "1,200.00"], [515, "48,800.00"]],
        [[40, "01-10-2026"], [110, "SALARY"], [425, "50,000.00"], [515, "50,000.00"]],
      ],
    ]);
    const { parsed } = await readStatement({ bytes: pdf }, { providers: [] });
    expect(parsed.rows.map((r) => [r.date, r.amountMinor])).toEqual([
      ["2026-10-01", 5_000_000],
      ["2026-10-02", -120_000],
    ]);
  });
});

describe("privacy-safe layout hints for the server log", () => {
  it("never includes names, numbers or amounts", () => {
    const hints = layoutHints(SBI_TEXT);
    // Masked digits all become "9", so any other digit would be a leak.
    expect(hints).not.toMatch(/TEST USER|ZOMATO|85,000|427598765432|[0-8]/);
    expect(hints).toContain("Txn Date  Value Date  Description");
    expect(hints).toContain("99 aaa 9999");
  });
});
