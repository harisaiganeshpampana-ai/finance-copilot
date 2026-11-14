// Shared (browser + server) shapes for bank statement uploads. No server code here.

import type { CurrencyCode } from "@/lib/currency";

/** What an upload did, shown to the user in the "audit ready" screen. */
export type StatementImportResult = {
  imported: number; // new rows
  alreadyUploaded: number; // rows that were in an earlier upload
  skipped: number; // lines in the table that weren't transactions
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  moneyInMinor: number; // paise
  moneyOutMinor: number; // paise (positive)
  currency: CurrencyCode;
};

export type UploadStatementResponse = { ok: true; result: StatementImportResult } | { ok: false; error: string };
