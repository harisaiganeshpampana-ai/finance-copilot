import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { decodeText, detectKind, extractStatement, pdfItemsToLines, pdfLinesToTable } from "@/lib/server/statement-extract";
import { columnsFromHeader, StatementError } from "@/lib/server/statement-parser";
import { readStatement } from "@/lib/server/statement-upload";
import { hdfcStylePdf, makePdf } from "./fixtures/make-pdf";

const isHeader = (cells: string[]) => columnsFromHeader(cells) !== null;
const enc = (s: string) => new TextEncoder().encode(s);

describe("recognizing file types from their bytes", () => {
  it("detects PDF, Excel (xlsx, old xls, HTML 'xls') and text", () => {
    expect(detectKind(enc("%PDF-1.7 ..."))).toBe("pdf");
    expect(detectKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]))).toBe("excel");
    expect(detectKind(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1]))).toBe("excel");
    expect(detectKind(enc("  <html><table><tr><td>Date</td></tr></table>"))).toBe("excel");
    expect(detectKind(enc("Date,Description,Amount"))).toBe("text");
  });

  it("decodes UTF-16 text exports", () => {
    const utf16 = new Uint8Array([0xff, 0xfe, ...Array.from(Buffer.from("Date\tAmount", "utf16le"))]);
    expect(decodeText(utf16)).toBe("Date\tAmount");
  });
});

describe("PDF statements", () => {
  it("reads a multi-page PDF table: blank columns stay blank, wrapped lines join, repeated headers are skipped", async () => {
    const { parsed, currency, bank, method } = await readStatement({ bytes: hdfcStylePdf() }, { providers: [] });
    expect(method).toBe("reader");
    expect(bank).toBe("HDFC Bank");
    expect(currency).toBe("INR"); // HDFC's home currency (no symbol in the text)
    expect(parsed.rows.map((r) => [r.date, r.amountMinor, r.category])).toEqual([
      ["2026-10-01", 8_500_000, "income"],
      ["2026-10-03", -45_050, "dining"],
      ["2026-10-15", -64_900, "subscriptions"],
    ]);
    expect(parsed.rows[1].description).toBe("UPI-SWIGGY-SWIGGY@YBL ORDER 12345 BANGALORE");
    expect(parsed.closingBalanceMinor).toBe(10_140_050);
  });

  it("explains scanned PDFs with no text", async () => {
    await expect(extractStatement(makePdf([[]]), { isHeader })).rejects.toThrow(/no readable text/);
  });

  it("explains damaged PDFs", async () => {
    await expect(extractStatement(enc("%PDF-1.4 garbage"), { isHeader })).rejects.toBeInstanceOf(StatementError);
  });

  it("groups text pieces into lines and cells by position", () => {
    const item = (str: string, x: number, y: number, width = str.length * 5) => ({ str, x, y, width, fontSize: 9 });
    const lines = pdfItemsToLines([item("Date", 40, 800), item("Amount", 300, 800), item("01/10/26", 40, 784), item("UBER", 100, 784), item("TRIP", 122, 784), item("-250.00", 300, 784)]);
    expect(lines.map((l) => l.map((c) => c.text))).toEqual([
      ["Date", "Amount"],
      ["01/10/26", "UBER TRIP", "-250.00"],
    ]);
  });

  it("puts each value under the header column it lines up with", () => {
    const cell = (text: string, x0: number) => ({ text, x0, x1: x0 + text.length * 5 });
    const table = pdfLinesToTable(
      [
        [cell("Date", 40), cell("Description", 100), cell("Debit", 300), cell("Credit", 380), cell("Balance", 460)],
        [cell("02/10/26", 40), cell("REFUND", 100), cell("50.00", 385), cell("150.00", 465)],
      ],
      isHeader,
    );
    expect(table[1]).toEqual(["02/10/26", "REFUND", "", "50.00", "150.00"]);
  });
});

describe("Excel statements", () => {
  const workbook = (rows: unknown[][], bookType: XLSX.BookType) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Summary"], ["Nothing here"]]), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Transactions");
    return new Uint8Array(XLSX.write(wb, { type: "array", bookType }) as ArrayBuffer);
  };
  const rows = [
    ["ICICI Bank Limited"],
    ["Value Date", "Transaction Remarks", "Withdrawal Amount (INR )", "Deposit Amount (INR )", "Balance (INR )"],
    ["05/10/2026", "UPI/BIGBASKET/Groceries", "2,310.00", "", "47,690.00"],
    ["01/10/2026", "NEFT SALARY", "", "50,000.00", "50,000.00"],
  ];

  it("reads .xlsx files, finding the transactions sheet", async () => {
    const { parsed, bank, currency } = await readStatement({ bytes: workbook(rows, "xlsx") }, { providers: [] });
    expect(bank).toBe("ICICI Bank");
    expect(currency).toBe("INR");
    expect(parsed.rows.map((r) => [r.date, r.amountMinor, r.category])).toEqual([
      ["2026-10-01", 5_000_000, "income"],
      ["2026-10-05", -231_000, "groceries"],
    ]);
  });

  it("reads old .xls files", async () => {
    const { parsed } = await readStatement({ bytes: workbook(rows, "biff8") }, { providers: [] });
    expect(parsed.rows).toHaveLength(2);
  });

  it("reads real date cells (not just text)", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Date", "Description", "Amount"], [new Date(Date.UTC(2026, 9, 7)), "TESCO STORES", -12.5]], { cellDates: true }),
      "Sheet1",
    );
    const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    const { parsed } = await readStatement({ bytes, currency: "GBP" }, { providers: [] });
    expect(parsed.rows[0]).toMatchObject({ date: "2026-10-07", amountMinor: -1_250, category: "groceries" });
  });

  it("explains spreadsheets it can't open", async () => {
    await expect(extractStatement(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0]), { isHeader })).rejects.toBeInstanceOf(StatementError);
  });
});
