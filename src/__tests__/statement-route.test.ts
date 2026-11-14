import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMock = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => sessionMock);

const uploadMock = vi.hoisted(() => ({ importStatement: vi.fn() }));
vi.mock("@/lib/server/statement-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/statement-upload")>()),
  importStatement: uploadMock.importStatement,
}));

import { maxDuration, POST } from "@/app/api/statements/upload/route";
import { resetRateLimitForTests } from "@/lib/server/copilot";
import { StatementError } from "@/lib/server/statement-parser";
import { StatementConflictError } from "@/lib/server/statement-upload";
import { CANARA_CSV } from "./fixtures/canara-statement";

const USER = { id: "64b0000000000000000000aa", email: "a@example.com" };
const RESULT = { imported: 9, alreadyUploaded: 0, skipped: 4, periodStart: "2026-10-01", periodEnd: "2026-10-28", moneyInMinor: 1, moneyOutMinor: 2, currency: "INR", bank: "Canara Bank", method: "reader" };

function upload(file?: File | string, fields: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const body = new FormData();
  if (file !== undefined) body.append("file", file);
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return POST(new Request("http://localhost/api/statements/upload", { method: "POST", body, headers }));
}
const makeFile = (text = CANARA_CSV, name = "canara.csv", type = "text/csv") => new File([text], name, { type });

beforeEach(() => {
  resetRateLimitForTests();
  sessionMock.getCurrentUser.mockResolvedValue(USER);
  uploadMock.importStatement.mockResolvedValue(RESULT);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/statements/upload", () => {
  it("imports the file for the logged-in user, with auto-detected currency by default", async () => {
    const res = await upload(makeFile());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: RESULT });
    const [userId, file] = uploadMock.importStatement.mock.calls[0];
    expect(userId).toBe(USER.id);
    expect(file).toMatchObject({ name: "canara.csv", password: undefined, currency: null });
    expect(new TextDecoder().decode(file.bytes)).toBe(CANARA_CSV);
  });

  it("allows enough time for AI reading", () => {
    expect(maxDuration).toBe(180);
  });

  it("accepts PDF, Excel and CSV files, and passes the PDF password and chosen currency", async () => {
    for (const name of ["s.pdf", "s.PDF", "s.xlsx", "s.xls", "s.csv", "s.txt"]) {
      expect((await upload(makeFile("x", name, ""))).status).toBe(200);
    }
    await upload(makeFile("x", "s.pdf", "application/pdf"), { password: "DDMM1990", currency: "USD" });
    expect(uploadMock.importStatement.mock.calls.at(-1)?.[1]).toMatchObject({ password: "DDMM1990", currency: "USD" });
  });

  it("rejects other file types and invalid fields", async () => {
    expect((await upload(makeFile("x", "statement.docx"))).status).toBe(415);
    expect((await upload(makeFile("x", "photo.png", "image/png"))).status).toBe(415);
    expect((await upload(makeFile(), { currency: "BTC" })).status).toBe(400);
    expect((await upload(makeFile(), { password: "x".repeat(129) })).status).toBe(400);
    expect(uploadMock.importStatement).not.toHaveBeenCalled();
  });

  it("requires login", async () => {
    sessionMock.getCurrentUser.mockResolvedValue(null);
    expect((await upload(makeFile())).status).toBe(401);
    expect(uploadMock.importStatement).not.toHaveBeenCalled();
  });

  it("requires a file", async () => {
    expect((await upload()).status).toBe(400);
    expect((await upload("just text")).status).toBe(400);
  });

  it("rejects empty and oversized files", async () => {
    expect((await upload(makeFile(""))).status).toBe(422);
    expect((await upload(makeFile("a".repeat(4 * 1024 * 1024 + 1)))).status).toBe(413);
    expect((await upload(makeFile(), {}, { "content-length": String(50 * 1024 * 1024) })).status).toBe(413);
    expect(uploadMock.importStatement).not.toHaveBeenCalled();
  });

  it("limits how often one user can upload", async () => {
    for (let i = 0; i < 10; i++) await upload(makeFile());
    expect((await upload(makeFile())).status).toBe(429);
  });

  it("passes friendly messages and codes through (password, currency)", async () => {
    uploadMock.importStatement.mockRejectedValue(new StatementError("This PDF is password-protected.", "password_required"));
    const res = await upload(makeFile("x", "s.pdf"));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, error: "This PDF is password-protected.", code: "password_required" });
  });

  it("explains a currency conflict", async () => {
    uploadMock.importStatement.mockRejectedValue(new StatementConflictError("INR", "USD"));
    const res = await upload(makeFile());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "currency_conflict", error: expect.stringMatching(/INR.*USD/) });
  });

  it("hides internal error details and never logs the password", async () => {
    uploadMock.importStatement.mockRejectedValue(new Error("mongodb+srv://user:secret@cluster"));
    const res = await upload(makeFile("x", "s.pdf"), { password: "MyPdfPass123" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("MyPdfPass123");
  });
});
