import { getCurrentUser } from "@/lib/auth/session";
import { isCurrencyCode } from "@/lib/currency";
import { isRateLimited } from "@/lib/server/copilot";
import { MAX_STATEMENT_BYTES, StatementError } from "@/lib/server/statement-parser";
import { importStatement, StatementConflictError } from "@/lib/server/statement-upload";
import { STATEMENT_EXTENSIONS, type UploadErrorCode, type UploadStatementResponse } from "@/lib/statement-types";

// Reading a long PDF with the AI fallback can take a while.
export const maxDuration = 60;

const fail = (error: string, status: number, code?: UploadErrorCode) =>
  Response.json({ ok: false, error, ...(code ? { code } : {}) } satisfies UploadStatementResponse, { status });

const TOO_LARGE = "That file is too large. The limit is 4 MB.";
const CHOOSE = "Please choose a statement file (PDF, Excel or CSV) to upload.";
const extensionOk = (name: string) => STATEMENT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

// POST /api/statements/upload — multipart form:
//   file      the statement (PDF, Excel .xlsx/.xls, CSV/TXT), up to 4 MB
//   password  optional, for password-protected PDFs (used once to open the file; never stored or logged)
//   currency  optional: "auto" (default) or USD / INR / EUR / GBP
// The user comes from the server-side session; everything is validated on the server before
// anything is saved to their account.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in to upload a statement.", 401);
  if (isRateLimited(`statement-upload:${user.id}`)) return fail("Too many uploads. Please wait a minute and try again.", 429);

  // Reject obviously oversized uploads before reading the body.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_STATEMENT_BYTES + 64 * 1024) return fail(TOO_LARGE, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(CHOOSE, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(CHOOSE, 400);
  if (file.size === 0) return fail("That file is empty.", 422);
  if (file.size > MAX_STATEMENT_BYTES) return fail(TOO_LARGE, 413);
  if (!extensionOk(file.name)) return fail("Please upload a PDF, Excel (.xlsx, .xls) or CSV statement.", 415);

  const rawPassword = form.get("password");
  if (rawPassword !== null && (typeof rawPassword !== "string" || rawPassword.length > 128)) return fail("Invalid password.", 400);
  const rawCurrency = form.get("currency");
  if (rawCurrency !== null && rawCurrency !== "auto" && !isCurrencyCode(rawCurrency)) return fail("Invalid currency.", 400);

  try {
    const result = await importStatement(user.id, {
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      password: rawPassword || undefined,
      currency: isCurrencyCode(rawCurrency) ? rawCurrency : null,
    });
    return Response.json({ ok: true, result } satisfies UploadStatementResponse);
  } catch (err) {
    if (err instanceof StatementError) return fail(err.message, 422, err.code);
    if (err instanceof StatementConflictError) return fail(err.message, 409, "currency_conflict");
    // Never log the password or file contents; only the error message.
    console.error("[statements] Upload failed:", err instanceof Error ? err.message : "error");
    return fail("Couldn't save your statement. Please try again.", 500);
  }
}
