// Shared (browser + server) shapes for bank statement uploads. No server code here.

import type { CurrencyCode } from "@/lib/currency";

/** What an upload did, shown to the user in the "audit ready" screen. */
export type StatementImportResult = {
  imported: number; // new rows
  alreadyUploaded: number; // rows that were in an earlier upload
  skipped: number; // lines that weren't transactions
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  moneyInMinor: number; // minor units (cents/paise)
  moneyOutMinor: number; // minor units (positive)
  currency: CurrencyCode;
  bank: string;
  /** "reader" = CalmOwe's built-in reader; "ai" = read by the AI fallback. */
  method: "reader" | "ai";
};

/** Why an upload needs something more from the user. */
export type UploadErrorCode = "password_required" | "password_incorrect" | "currency_required" | "unsupported_currency" | "currency_conflict";

export type UploadStatementResponse = { ok: true; result: StatementImportResult } | { ok: false; error: string; code?: UploadErrorCode };

/** File types the uploader accepts. */
export const STATEMENT_EXTENSIONS = [".pdf", ".csv", ".xlsx", ".xls", ".txt", ".tsv"] as const;
