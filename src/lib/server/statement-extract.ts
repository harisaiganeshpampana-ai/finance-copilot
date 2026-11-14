// SERVER-ONLY. Reads an uploaded statement file (PDF, Excel or CSV/TXT) into tables of text
// cells plus the plain text, for the statement parser and the AI fallback.
// The file type is decided from its actual bytes, not just its name.

import { csvToTable, StatementError } from "@/lib/server/statement-parser";

export type StatementKind = "pdf" | "excel" | "text";

export type ExtractedStatement = {
  kind: StatementKind;
  /** Candidate tables (Excel: one per sheet; PDF: the whole document laid out in rows). */
  tables: string[][][];
  /** Plain text of the whole statement (for currency/bank detection and the AI fallback). */
  text: string;
};

export const MAX_PDF_PAGES = 100;
const MAX_TEXT_CHARS = 400_000;

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);

/** What kind of file this is, from its first bytes (and name for plain text). */
export function detectKind(bytes: Uint8Array): StatementKind {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "excel"; // .xlsx (zip)
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return "excel"; // old .xls
  const head = new TextDecoder("utf-8").decode(bytes.slice(0, 512)).trimStart().toLowerCase();
  // Many banks' ".xls" downloads are really HTML tables; SheetJS reads those too.
  if (head.startsWith("<") && /<(html|table|\?xml)/.test(head)) return "excel";
  return "text";
}

/** Decodes text files saved as UTF-8 or UTF-16 (Excel's "Unicode text"). */
export function decodeText(bytes: Uint8Array): string {
  if (startsWith(bytes, [0xff, 0xfe])) return new TextDecoder("utf-16le").decode(bytes.slice(2));
  if (startsWith(bytes, [0xfe, 0xff])) return new TextDecoder("utf-16be").decode(bytes.slice(2));
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  // Not valid UTF-8 (lots of replacement characters): treat as Windows-1252 (old exports).
  const bad = (utf8.match(/�/g) ?? []).length;
  return bad > 5 ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

// ---------- PDF ----------

type PdfItem = { str: string; x: number; y: number; width: number; fontSize: number };
type Cell = { text: string; x0: number; x1: number };

/** Groups a page's text pieces into lines (same height) of cells (pieces close together). */
export function pdfItemsToLines(items: PdfItem[]): Cell[][] {
  const pieces = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfItem[][] = [];
  for (const item of pieces) {
    const line = lines[lines.length - 1];
    const tolerance = Math.max(2, (item.fontSize || 10) * 0.4);
    if (line && Math.abs(line[0].y - item.y) <= tolerance) line.push(item);
    else lines.push([item]);
  }
  return lines.map((line) => {
    const sorted = line.sort((a, b) => a.x - b.x);
    const cells: Cell[] = [];
    for (const item of sorted) {
      const last = cells[cells.length - 1];
      const gap = last ? item.x - last.x1 : Infinity;
      // A gap wider than about one character starts a new cell (a new column).
      if (last && gap < Math.max(3, (item.fontSize || 10) * 0.6)) {
        last.text += (gap > 0.5 ? " " : "") + item.str;
        last.x1 = Math.max(last.x1, item.x + item.width);
      } else {
        cells.push({ text: item.str, x0: item.x, x1: item.x + item.width });
      }
    }
    return cells.map((c) => ({ ...c, text: c.text.replace(/\s+/g, " ").trim() }));
  });
}

/**
 * Lays PDF lines out as a table using the header line's column positions, so a blank
 * Debit or Credit cell stays blank instead of shifting the other values left.
 * Lines before the header are kept as single cells (account details).
 */
export function pdfLinesToTable(lines: Cell[][], isHeader: (cells: string[]) => boolean): string[][] {
  const headerIndex = lines.findIndex((l) => isHeader(l.map((c) => c.text)));
  if (headerIndex === -1) return lines.map((l) => l.map((c) => c.text));
  const header = lines[headerIndex];
  const headerTexts = header.map((c) => c.text);
  const table: string[][] = lines.slice(0, headerIndex + 1).map((l) => l.map((c) => c.text));
  for (const line of lines.slice(headerIndex + 1)) {
    const texts = line.map((c) => c.text);
    if (texts.join("|") === headerTexts.join("|")) continue; // header repeated on each page
    const row = header.map(() => "");
    for (const cell of line) {
      // The header column this cell overlaps most, or else the nearest one.
      let best = 0;
      let bestScore = -Infinity;
      header.forEach((h, i) => {
        const overlap = Math.min(cell.x1, h.x1) - Math.max(cell.x0, h.x0);
        const distance = Math.abs((cell.x0 + cell.x1) / 2 - (h.x0 + h.x1) / 2);
        const score = overlap > 0 ? 10_000 + overlap : -distance;
        if (score > bestScore) [best, bestScore] = [i, score];
      });
      row[best] = row[best] ? `${row[best]} ${cell.text}` : cell.text;
    }
    table.push(row);
  }
  return mergeWrappedLines(table, headerIndex);
}

/**
 * Descriptions often wrap onto extra lines that have no date or amounts. Those lines are
 * joined to the transaction above them.
 */
function mergeWrappedLines(table: string[][], headerIndex: number): string[][] {
  const out = table.slice(0, headerIndex + 1);
  for (const row of table.slice(headerIndex + 1)) {
    const filled = row.map((c, i) => [c, i] as const).filter(([c]) => c);
    const prev = out[out.length - 1];
    const looksLikeContinuation =
      out.length > headerIndex + 1 && filled.length > 0 && filled.length <= 2 && filled.every(([c]) => !/\d{1,2}[-/. ][\dA-Za-z]{1,3}[-/. ]\d{2,4}|\d[\d,]*\.\d{2}/.test(c));
    if (looksLikeContinuation) {
      for (const [c, i] of filled) prev[i] = prev[i] ? `${prev[i]} ${c}` : c;
    } else {
      out.push(row);
    }
  }
  return out;
}

async function extractPdf(bytes: Uint8Array, password: string | undefined, isHeader: (cells: string[]) => boolean): Promise<ExtractedStatement> {
  const { getDocumentProxy, extractTextItems } = await import("unpdf");
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes), { password: password || undefined });
  } catch (err) {
    const e = err as { name?: string; code?: number } | null;
    if (e?.name === "PasswordException") {
      throw e.code === 2
        ? new StatementError("That password didn't open the PDF. Please check it and try again.", "password_incorrect")
        : new StatementError("This PDF is password-protected. Enter its password to continue.", "password_required");
    }
    throw new StatementError("We couldn't open that PDF. It may be damaged. Please download the statement again.");
  }
  try {
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new StatementError(`That PDF has more than ${MAX_PDF_PAGES} pages. Please upload a shorter period.`);
    }
    const { items } = await extractTextItems(pdf);
    const lines = items.flatMap((page) => pdfItemsToLines(page as PdfItem[]));
    const text = lines.map((l) => l.map((c) => c.text).join("  ")).join("\n").slice(0, MAX_TEXT_CHARS);
    if (!text.trim()) {
      throw new StatementError(
        "This PDF has no readable text (it may be a scanned photo). Please download the statement from your bank's website or app as a PDF, Excel or CSV file.",
      );
    }
    return { kind: "pdf", tables: [pdfLinesToTable(lines, isHeader)], text };
  } finally {
    // Free the parsed document (not in unpdf's type definitions on every version).
    await (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.().catch(() => {});
  }
}

// ---------- Excel ----------

async function extractExcel(bytes: Uint8Array): Promise<ExtractedStatement> {
  const XLSX = await import("xlsx");
  let workbook: import("xlsx").WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: "array", dense: true, sheetRows: 10_000, cellDates: true, cellHTML: false, cellFormula: false });
  } catch {
    throw new StatementError("We couldn't open that spreadsheet. Please save it as .xlsx or .csv and try again.");
  }
  // Real date cells become YYYY-MM-DD (never ambiguous); numbers stay plain numbers.
  const cellText = (c: unknown) => {
    if (c instanceof Date) {
      if (Number.isNaN(c.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`;
    }
    return c == null ? "" : String(c);
  };
  const tables = workbook.SheetNames.slice(0, 20).map((name) =>
    (XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: "", blankrows: false }) as unknown[][]).map((row) =>
      row.map(cellText),
    ),
  );
  const text = tables
    .map((t) => t.map((r) => r.join("  ")).join("\n"))
    .join("\n\n")
    .slice(0, MAX_TEXT_CHARS);
  return { kind: "excel", tables, text };
}

// ---------- Entry point ----------

/** Reads any supported statement file. Throws StatementError with a friendly message. */
export async function extractStatement(
  bytes: Uint8Array,
  options: { password?: string; isHeader: (cells: string[]) => boolean },
): Promise<ExtractedStatement> {
  if (bytes.length === 0) throw new StatementError("That file is empty.");
  const kind = detectKind(bytes);
  if (kind === "pdf") return extractPdf(bytes, options.password, options.isHeader);
  if (kind === "excel") return extractExcel(bytes);
  const text = decodeText(bytes);
  if (text.includes("\u0000")) throw new StatementError("That doesn't look like a statement file. Please upload a PDF, Excel or CSV statement.");
  if (!text.trim()) throw new StatementError("That file is empty.");
  return { kind: "text", tables: [csvToTable(text)], text: text.slice(0, MAX_TEXT_CHARS) };
}
