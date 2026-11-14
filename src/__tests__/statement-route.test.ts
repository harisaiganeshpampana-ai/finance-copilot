import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMock = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => sessionMock);

const uploadMock = vi.hoisted(() => ({ importStatement: vi.fn() }));
vi.mock("@/lib/server/statement-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/statement-upload")>()),
  importStatement: uploadMock.importStatement,
}));

import { POST } from "@/app/api/statements/upload/route";
import { StatementError } from "@/lib/server/statement-csv";
import { StatementConflictError } from "@/lib/server/statement-upload";
import { CANARA_CSV } from "./fixtures/canara-statement";

const USER = { id: "64b0000000000000000000aa", email: "a@example.com" };
const RESULT = { imported: 9, alreadyUploaded: 0, skipped: 4, periodStart: "2026-10-01", periodEnd: "2026-10-28", moneyInMinor: 1, moneyOutMinor: 2, currency: "INR" };

function upload(file?: File | string, headers: Record<string, string> = {}) {
  const body = new FormData();
  if (file !== undefined) body.append("file", file);
  return POST(new Request("http://localhost/api/statements/upload", { method: "POST", body, headers }));
}
const csvFile = (text = CANARA_CSV, name = "canara.csv", type = "text/csv") => new File([text], name, { type });

beforeEach(() => {
  sessionMock.getCurrentUser.mockResolvedValue(USER);
  uploadMock.importStatement.mockResolvedValue(RESULT);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/statements/upload", () => {
  it("imports the file for the logged-in user", async () => {
    const res = await upload(csvFile());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: RESULT });
    expect(uploadMock.importStatement).toHaveBeenCalledWith(USER.id, { name: "canara.csv", text: CANARA_CSV });
  });

  it("requires login", async () => {
    sessionMock.getCurrentUser.mockResolvedValue(null);
    const res = await upload(csvFile());
    expect(res.status).toBe(401);
    expect(uploadMock.importStatement).not.toHaveBeenCalled();
  });

  it("requires a file", async () => {
    expect((await upload()).status).toBe(400);
    expect((await upload("just text")).status).toBe(400);
  });

  it("only accepts .csv files", async () => {
    expect((await upload(csvFile("x", "statement.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))).status).toBe(415);
    expect((await upload(csvFile("x", "statement.csv", "image/png"))).status).toBe(415);
    expect((await upload(csvFile("x", "STATEMENT.CSV", "application/vnd.ms-excel"))).status).toBe(200); // how Windows labels CSVs
  });

  it("rejects empty and oversized files", async () => {
    expect((await upload(csvFile(""))).status).toBe(422);
    expect((await upload(csvFile("a".repeat(2 * 1024 * 1024 + 1)))).status).toBe(413);
    expect((await upload(csvFile(), { "content-length": String(50 * 1024 * 1024) })).status).toBe(413);
    expect(uploadMock.importStatement).not.toHaveBeenCalled();
  });

  it("shows the parser's friendly message for unreadable statements", async () => {
    uploadMock.importStatement.mockRejectedValue(new StatementError("We couldn't find the transaction table."));
    const res = await upload(csvFile());
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, error: "We couldn't find the transaction table." });
  });

  it("explains a currency conflict", async () => {
    uploadMock.importStatement.mockRejectedValue(new StatementConflictError());
    expect((await upload(csvFile())).status).toBe(409);
  });

  it("hides internal error details", async () => {
    uploadMock.importStatement.mockRejectedValue(new Error("mongodb+srv://user:secret@cluster"));
    const res = await upload(csvFile());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
