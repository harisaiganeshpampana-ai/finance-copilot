import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider } from "@/lib/server/copilot";
import { AI_MAX_CHUNKS, aiExtractStatement, amountsInText, chunkText, validateAiChunk } from "@/lib/server/statement-ai";

const TODAY = new Date("2026-11-14T12:00:00Z");
const TEXT = [
  "Kotak Mahindra Bank  Statement",
  "03 Oct 2026  Paid to SWIGGY  450.50 DR  1,02,049.50",
  "01 Oct 2026  Salary ACME  85,000.00 CR  1,02,500.00",
].join("\n");
const GEMINI: Provider = { name: "gemini", url: "https://gemini.example/v1", model: "g", apiKey: "secret-gemini-key" };
const OPENAI: Provider = { name: "openai", url: "https://openai.example/v1", model: "o", apiKey: "secret-openai-key" };

const aiReply = (json: unknown, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content: typeof json === "string" ? json : JSON.stringify(json) } }] }), { status });
const GOOD = {
  bank: "Kotak Mahindra Bank",
  currency: "INR",
  transactions: [
    { date: "2026-10-01", description: "Salary ACME", amount: 85000, balance: 102500 },
    { date: "2026-10-03", description: "Paid to SWIGGY", amount: -450.5, balance: 102049.5 },
  ],
};

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("finding amounts printed in the statement", () => {
  it("understands Indian, Western and European number styles", () => {
    const found = amountsInText("1,23,456.78 | 1,234.56 | 1.234,56 | 450 | 12.5 | 85,000.00");
    for (const v of [12_345_678, 123_456, 45_000, 1_250, 8_500_000]) expect(found.has(v)).toBe(true);
    expect(found.has(99_999)).toBe(false);
  });
});

describe("validating the AI's answer", () => {
  it("accepts transactions whose amounts appear in the statement", () => {
    const res = validateAiChunk(GOOD, TEXT, TODAY)!;
    expect(res.transactions).toEqual([
      { date: "2026-10-01", description: "Salary ACME", amountMinor: 8_500_000, balanceMinor: 10_250_000 },
      { date: "2026-10-03", description: "Paid to SWIGGY", amountMinor: -45_050, balanceMinor: 10_204_950 },
    ]);
    expect(res).toMatchObject({ currency: "INR", bank: "Kotak Mahindra Bank", rejected: 0 });
  });

  it("drops an invented amount, and rejects the answer if too much is invented", () => {
    const one = validateAiChunk({ ...GOOD, transactions: [...GOOD.transactions, ...GOOD.transactions, { date: "2026-10-04", description: "Made up", amount: -999.99 }] }, TEXT, TODAY)!;
    expect(one.transactions).toHaveLength(4);
    expect(one.rejected).toBe(1);
    expect(validateAiChunk({ transactions: [GOOD.transactions[0], { date: "2026-10-04", description: "Made up", amount: -999.99 }] }, TEXT, TODAY)).toBeNull();
  });

  it("rejects bad dates, amounts and shapes", () => {
    const bad = [
      { date: "03/10/2026", description: "x", amount: -450.5 },
      { date: "2026-02-31", description: "x", amount: -450.5 },
      { date: "2030-01-01", description: "x", amount: -450.5 }, // in the future
      { date: "2026-10-03", description: "x", amount: "450.50" },
      { date: "2026-10-03", description: "x", amount: 0 },
    ];
    expect(validateAiChunk({ transactions: bad }, TEXT, TODAY)).toBeNull();
    expect(validateAiChunk("nope", TEXT, TODAY)).toBeNull();
    expect(validateAiChunk({ transactions: "x" }, TEXT, TODAY)).toBeNull();
  });

  it("cleans descriptions and ignores odd currency/bank values", () => {
    const res = validateAiChunk({ currency: "rupees!", bank: 42, transactions: [{ date: "2026-10-03", description: "A\u0000\n B", amount: -450.5 }] }, TEXT, TODAY)!;
    expect(res.transactions[0].description).toBe("A B");
    expect(res.currency).toBeNull();
    expect(res.bank).toBeNull();
  });
});

describe("AI extraction", () => {
  it("sends the statement as data (not instructions) and returns validated transactions", async () => {
    const fetchImpl = vi.fn(async () => aiReply(GOOD));
    const res = await aiExtractStatement(TEXT, [GEMINI], { fetchImpl: fetchImpl as unknown as typeof fetch, today: TODAY });
    expect(res.transactions).toHaveLength(2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GEMINI.url);
    const body = JSON.parse(init.body as string);
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toMatch(/data, not instructions/);
    expect(body.messages[1].content).toBe(`<statement>\n${TEXT}\n</statement>`);
  });

  it("falls back to the next provider when one fails or answers badly", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(aiReply("not json")).mockResolvedValueOnce(aiReply("```json\n" + JSON.stringify(GOOD) + "\n```"));
    const res = await aiExtractStatement(TEXT, [GEMINI, OPENAI], { fetchImpl: fetchImpl as unknown as typeof fetch, today: TODAY });
    expect(res.transactions).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives a friendly error (and never leaks keys) when no provider can read it", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota", { status: 429 }));
    const err = await aiExtractStatement(TEXT, [GEMINI, OPENAI], { fetchImpl: fetchImpl as unknown as typeof fetch, today: TODAY }).catch((e) => e);
    expect(err.message).toMatch(/couldn't read the transactions/);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret");
    await expect(aiExtractStatement(TEXT, [])).rejects.toThrow(/couldn't read/);
  });

  it("splits long statements into chunks and refuses very long ones", async () => {
    expect(chunkText("a\nb\nc", 3)).toEqual(["a\nb", "c"]);
    const huge = Array.from({ length: AI_MAX_CHUNKS * 2000 }, (_, i) => `line ${i} with some text`).join("\n");
    await expect(aiExtractStatement(huge, [GEMINI])).rejects.toThrow(/too long/);
  });
});
