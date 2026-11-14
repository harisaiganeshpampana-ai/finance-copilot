import { describe, expect, it, vi } from "vitest";

// Stand-in for the PDF library: behaves like PDF.js does for password-protected files.
const pdf = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("unpdf", () => ({
  getDocumentProxy: (_data: Uint8Array, options: { password?: string }) => pdf.open(options),
  extractTextItems: async () => ({ totalPages: 1, items: [[]] }),
}));

import { extractStatement } from "@/lib/server/statement-extract";

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 encrypted");
const passwordError = (code: number) => Object.assign(new Error("Password"), { name: "PasswordException", code });
const isHeader = () => false;

describe("password-protected PDFs", () => {
  it("asks for the password when the PDF needs one", async () => {
    pdf.open.mockRejectedValueOnce(passwordError(1));
    const err = await extractStatement(PDF_BYTES, { isHeader }).catch((e) => e);
    expect(err.code).toBe("password_required");
    expect(pdf.open).toHaveBeenCalledWith({ password: undefined });
  });

  it("says when the password is wrong", async () => {
    pdf.open.mockRejectedValueOnce(passwordError(2));
    const err = await extractStatement(PDF_BYTES, { password: "wrong", isHeader }).catch((e) => e);
    expect(err.code).toBe("password_incorrect");
  });

  it("passes the password to the PDF reader", async () => {
    pdf.open.mockResolvedValueOnce({ numPages: 1, destroy: vi.fn(async () => {}) });
    // Opens fine; this fake PDF just has no text.
    await expect(extractStatement(PDF_BYTES, { password: "DDMM1990", isHeader })).rejects.toThrow(/no readable text/);
    expect(pdf.open).toHaveBeenLastCalledWith({ password: "DDMM1990" });
  });

  it("refuses PDFs with too many pages", async () => {
    pdf.open.mockResolvedValueOnce({ numPages: 500, destroy: vi.fn(async () => {}) });
    await expect(extractStatement(PDF_BYTES, { isHeader })).rejects.toThrow(/more than 100 pages/);
  });
});
