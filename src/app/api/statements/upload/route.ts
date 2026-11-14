import { getCurrentUser } from "@/lib/auth/session";
import { MAX_STATEMENT_BYTES, StatementError } from "@/lib/server/statement-csv";
import { importStatement, StatementConflictError } from "@/lib/server/statement-upload";
import type { UploadStatementResponse } from "@/lib/statement-types";

const fail = (error: string, status: number) => Response.json({ ok: false, error } satisfies UploadStatementResponse, { status });

const CSV_TYPES = new Set(["", "text/csv", "text/plain", "application/csv", "application/vnd.ms-excel", "text/comma-separated-values"]);

// POST /api/statements/upload — multipart form with one `file` field: a bank statement CSV.
// The user comes from the server-side session; the file is size-checked, type-checked and
// fully validated on the server before anything is saved to their account.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in to upload a statement.", 401);

  // Reject obviously oversized uploads before reading the body.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_STATEMENT_BYTES + 64 * 1024) return fail("That file is too large. The limit is 2 MB.", 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Please choose a CSV file to upload.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Please choose a CSV file to upload.", 400);
  if (file.size === 0) return fail("That file is empty.", 422);
  if (file.size > MAX_STATEMENT_BYTES) return fail("That file is too large. The limit is 2 MB.", 413);
  if (!/\.csv$/i.test(file.name) || !CSV_TYPES.has(file.type.toLowerCase())) {
    return fail("Please upload your statement as a .csv file.", 415);
  }

  try {
    const text = new TextDecoder("utf-8").decode(await file.arrayBuffer());
    const result = await importStatement(user.id, { name: file.name, text });
    return Response.json({ ok: true, result } satisfies UploadStatementResponse);
  } catch (err) {
    if (err instanceof StatementError) return fail(err.message, 422);
    if (err instanceof StatementConflictError) {
      return fail("Your account already has transactions in another currency, so this statement can't be added.", 409);
    }
    console.error("[statements] Upload failed:", err instanceof Error ? err.message : err);
    return fail("Couldn't save your statement. Please try again.", 500);
  }
}
