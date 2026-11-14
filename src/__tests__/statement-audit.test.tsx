// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => router }));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resetCurrencyForTests, useCurrency } from "@/components/currency/currency-store";
import { DashboardView, EmptyDashboard } from "@/components/dashboard/DashboardView";
import { checkStatementFile } from "@/components/dashboard/UploadStatement";
import { type FinancialData, MOCK_EXCHANGE_RATES, MOCK_FINANCIAL_DATA } from "@/data/mockTransactions";
import { convertMinor } from "@/lib/currency";
import { buildFinancialContext, buildSystemPrompt, buildUserPrompt } from "@/lib/server/copilot";
import { getFinancialData, type TransactionStore } from "@/lib/server/transactions";

const STATEMENT = { bank: "Canara Bank", fileName: "canara-oct.csv", uploadedAt: "2026-11-14T12:00:00.000Z", periodStart: "2026-10-01", periodEnd: "2026-10-28" };

/** A user's data after uploading a Canara statement: rupees (paise), as of the statement's end. */
const INR_DATA: FinancialData = {
  transactions: [
    { id: "1", date: "2026-10-28", merchant: "ATM CASH WITHDRAWAL", category: "other", amountCents: -500_000 },
    { id: "2", date: "2026-10-05", merchant: "Swiggy", description: "UPI/DR/1/SWIGGY/YESB/x/Order", category: "dining", amountCents: -45_050 },
    { id: "3", date: "2026-10-02", merchant: "NEFT Sharma Properties", category: "housing", amountCents: -2_500_000 },
    { id: "4", date: "2026-10-01", merchant: "Acme Technologies", category: "income", amountCents: 8_500_000 },
  ],
  openingBalanceCents: 1_750_000,
  asOf: "2026-10-28",
  currency: "INR",
  statement: STATEMENT,
};

beforeAll(installBrowserStubs);
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.localStorage.clear();
  resetCurrencyForTests();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("converting between the data currency and the display currency", () => {
  it("keeps same-currency amounts exact and converts others with one rounding", () => {
    expect(convertMinor(12_345, "INR", "INR", MOCK_EXCHANGE_RATES)).toBe(12_345);
    expect(convertMinor(8_350, "INR", "USD", MOCK_EXCHANGE_RATES)).toBe(100); // ₹83.50 = $1.00
    expect(convertMinor(100, "USD", "INR", MOCK_EXCHANGE_RATES)).toBe(8_350);
    expect(convertMinor(-8_350, "INR", "USD", MOCK_EXCHANGE_RATES)).toBe(-100);
    expect(() => convertMinor(1.5, "INR", "INR", MOCK_EXCHANGE_RATES)).toThrow();
  });
});

describe("loading uploaded data for the dashboard and Copilot", () => {
  const store = (statement: typeof STATEMENT | null): TransactionStore => ({
    listByUser: vi.fn(async () => INR_DATA.transactions),
    countByUser: vi.fn(async () => 4),
    insertForUser: vi.fn(),
    getOpeningBalance: vi.fn(async () => 1_750_000),
    setOpeningBalance: vi.fn(),
    getDataProfile: vi.fn(async () => ({ currency: "INR" as const, statement })),
  });

  it("uses the statement's latest transaction as 'today', so last month's statement shows last month", async () => {
    const data = await getFinancialData("64b0000000000000000000aa", store(STATEMENT), "2026-11-14");
    expect(data).toMatchObject({ asOf: "2026-10-28", currency: "INR", statement: STATEMENT, openingBalanceCents: 1_750_000 });
  });

  it("keeps today's date when there's no statement", async () => {
    const data = await getFinancialData("64b0000000000000000000aa", store(null), "2026-11-14");
    expect(data.asOf).toBe("2026-11-14");
    expect(data.statement).toBeUndefined();
  });
});

describe("AI Copilot with an uploaded statement", () => {
  const ctx = buildFinancialContext(INR_DATA);

  it("tells the AI the data is an uploaded Canara statement in INR", () => {
    expect(ctx.currency).toBe("INR");
    expect(ctx.dataSource).toEqual({
      type: "Uploaded bank statement (Monthly Financial Audit)",
      bank: "Canara Bank",
      statementPeriod: "2026-10-01 to 2026-10-28",
      uploadedAt: "2026-11-14",
    });
    expect(ctx.summary.currentBalance).toBe(17500 + 85000 - 25000 - 450.5 - 5000);
  });

  it("includes server-computed audit figures: monthly totals, categories, largest expenses", () => {
    expect(ctx.audit?.months).toEqual([{ month: "2026-10", moneyIn: 85000, moneyOut: 30450.5, net: 54549.5 }]);
    expect(ctx.audit?.spendingByCategory[0]).toEqual({ category: "housing", spent: 25000, shareOfSpending: "82.1%" });
    expect(ctx.audit?.largestExpenses.map((e) => e.merchant)).toEqual(["NEFT Sharma Properties", "ATM CASH WITHDRAWAL", "Swiggy"]);
    expect(ctx.transactions).toContainEqual(expect.objectContaining({ merchant: "Swiggy", description: "UPI/DR/1/SWIGGY/YESB/x/Order" }));
  });

  it("asks for a Monthly Financial Audit and handles rupee data without converting it", () => {
    const prompt = buildSystemPrompt("INR", "INR");
    expect(prompt).toContain("All amounts in the data are already INR; do not convert them.");
    expect(prompt).toContain("Monthly Financial Audit");
    expect(prompt).toContain("Do not provide investment advice");
    expect(buildSystemPrompt("USD", "INR")).toContain("1 INR = 0.011976 USD");
    // Sample (dollar) users get the original wording.
    expect(buildSystemPrompt("INR")).toContain("All amounts in the data are USD; convert at 1 USD = 83.5 INR");
  });

  it("does affordability math in exact rupees", () => {
    const prompt = buildUserPrompt("Can I afford a ₹5,000 phone?", "INR", INR_DATA);
    expect(prompt).toContain("current balance ₹72,049.50 minus cost = ₹67,049.50");
  });

  it("does not send audit fields for sample (dollar) data", () => {
    const sample = buildFinancialContext(MOCK_FINANCIAL_DATA);
    expect(sample.currency).toBe("USD");
    expect("dataSource" in sample).toBe(false);
    expect("audit" in sample).toBe(false);
  });
});

describe("dashboard with an uploaded statement", () => {
  it("shows the audit bar and exact rupee amounts", () => {
    function PickInr() {
      const { setCurrency } = useCurrency();
      return (
        <button type="button" onClick={() => setCurrency("INR")}>
          inr
        </button>
      );
    }
    render(
      <>
        <PickInr />
        <DashboardView data={INR_DATA} />
      </>,
    );
    const bar = within(screen.getByTestId("data-source-bar"));
    expect(bar.getByText(/Canara Bank · 1 Oct 2026 – 28 Oct 2026/)).toBeTruthy();
    expect(bar.getByText("From canara-oct.csv")).toBeTruthy();
    expect(bar.getByRole("button", { name: "Upload another statement" })).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole("button", { name: "inr" })));
    expect(screen.getByTestId("stat-total-balance").textContent).toBe("₹72,049.50");
    expect(screen.getByText("-₹450.50")).toBeTruthy(); // Swiggy, exact paise
  });

  it("converts rupee data when another display currency is chosen", () => {
    render(<DashboardView data={INR_DATA} />); // default display: USD
    expect(screen.getByTestId("stat-total-balance").textContent).toBe("$862.87"); // ₹72,049.50 / 83.5
  });

  it("invites sample-data users to upload a statement", () => {
    render(<DashboardView data={MOCK_FINANCIAL_DATA} />);
    const bar = within(screen.getByTestId("data-source-bar"));
    expect(bar.getByText("You're viewing sample data")).toBeTruthy();
    expect(bar.getByRole("button", { name: "Upload Bank Statement" })).toBeTruthy();
  });

  it("offers the upload on the empty dashboard too", () => {
    render(<EmptyDashboard />);
    expect(screen.getByRole("button", { name: "Upload Bank Statement" })).toBeTruthy();
  });
});

describe("Upload Bank Statement modal", () => {
  const openModal = () => {
    render(<DashboardView data={MOCK_FINANCIAL_DATA} />);
    fireEvent.click(screen.getByRole("button", { name: "Upload Bank Statement" }));
    return within(screen.getByRole("dialog", { name: "Upload bank statement" }));
  };
  const choose = async (file: File) => {
    await act(async () => {
      fireEvent.change(screen.getByTestId("statement-input"), { target: { files: [file] } });
    });
  };

  it("uploads the CSV, shows the audit summary, then switches to rupees and refreshes", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          result: { imported: 9, alreadyUploaded: 0, skipped: 4, periodStart: "2026-10-01", periodEnd: "2026-10-28", moneyInMinor: 8_500_000, moneyOutMinor: 3_528_950, currency: "INR" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const dialog = openModal();
    expect(dialog.getByText(/Canara Bank statement as a CSV file/)).toBeTruthy();
    await choose(new File(["Txn Date,Description,Debit,Credit"], "canara.csv", { type: "text/csv" }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/statements/upload");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);

    expect(await dialog.findByText("9 new transactions imported")).toBeTruthy();
    expect(dialog.getByTestId("audit-money-in").textContent).toBe("₹85,000");
    expect(dialog.getByTestId("audit-money-out").textContent).toBe("₹35,290");

    fireEvent.click(dialog.getByRole("button", { name: "View my audit" }));
    expect(router.refresh).toHaveBeenCalled();
    expect(window.localStorage.getItem("calmowe.currency")).toBe("INR");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows the server's message when the file can't be read", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: "We couldn't find the transaction table." }), { status: 422 }));
    const dialog = openModal();
    await choose(new File(["x"], "canara.csv", { type: "text/csv" }));
    expect((await dialog.findByRole("alert")).textContent).toBe("We couldn't find the transaction table.");
  });

  it("catches wrong file types before uploading (the server checks again)", async () => {
    const dialog = openModal();
    await choose(new File(["x"], "statement.pdf", { type: "application/pdf" }));
    expect(dialog.getByRole("alert").textContent).toMatch(/\.csv file/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(checkStatementFile({ name: "a.csv", size: 3 * 1024 * 1024 })).toMatch(/too large/);
    expect(checkStatementFile({ name: "a.CSV", size: 10 })).toBeNull();
  });

  it("closes with Escape", () => {
    openModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("contains no emojis (design rule)", () => {
    const source = readFileSync(join(process.cwd(), "src/components/dashboard/UploadStatement.tsx"), "utf8");
    expect(/\p{Extended_Pictographic}/u.test(source)).toBe(false);
  });
});
