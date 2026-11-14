// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";

const nav = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/dashboard" }));

const sessionMock = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => sessionMock);

const dataMock = vi.hoisted(() => ({ seedSampleData: vi.fn() }));
vi.mock("@/lib/server/transactions", () => dataMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { generateSampleData } from "@/app/(app)/dashboard/actions";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { resetCurrencyForTests } from "@/components/currency/currency-store";

beforeAll(installBrowserStubs);
beforeEach(() => {
  window.localStorage.clear();
  resetCurrencyForTests();
  sessionMock.getCurrentUser.mockResolvedValue({ id: "64b0000000000000000000aa", name: "Hari" });
  dataMock.seedSampleData.mockResolvedValue({ created: true, count: 10 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardView with a user's database data", () => {
  it("calculates balance, income and expenses from the given transactions", () => {
    render(
      <DashboardView
        data={{
          openingBalanceCents: 100000,
          asOf: "2026-11-14",
          transactions: [
            { id: "1", date: "2026-11-14", merchant: "Asha Bakery", category: "income", amountCents: 50000 },
            { id: "2", date: "2026-11-13", merchant: "Metro Card", category: "transport", amountCents: -2500 },
            { id: "3", date: "2026-10-30", merchant: "Old Rent", category: "housing", amountCents: -40000 },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("stat-total-balance").textContent).toBe("$1,075.00"); // 1,000 + 500 - 25 - 400
    expect(screen.getByTestId("stat-income").textContent).toBe("$500.00"); // this month only
    expect(screen.getByTestId("stat-expenses").textContent).toBe("$25.00"); // October rent excluded
    expect(screen.getByText("3 transactions")).toBeTruthy();
  });

  it("shows an empty state with 'Generate sample data' when the user has no transactions", () => {
    render(<DashboardView data={{ transactions: [], openingBalanceCents: 0, asOf: "2026-11-14" }} />);
    expect(screen.getByRole("heading", { name: "No transactions yet" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate sample data" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("Generate sample data", () => {
  it("button calls the server action and refreshes the dashboard", async () => {
    render(<DashboardView data={{ transactions: [], openingBalanceCents: 0, asOf: "2026-11-14" }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate sample data" }));
    });
    expect(dataMock.seedSampleData).toHaveBeenCalledWith("64b0000000000000000000aa");
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("server action uses the logged-in user from the session, never browser input", async () => {
    expect(await generateSampleData()).toEqual({ ok: true, created: true });
    expect(dataMock.seedSampleData).toHaveBeenCalledWith("64b0000000000000000000aa");
  });

  it("server action refuses when logged out", async () => {
    sessionMock.getCurrentUser.mockResolvedValueOnce(null);
    expect(await generateSampleData()).toEqual({ ok: false, error: "Please log in again." });
    expect(dataMock.seedSampleData).not.toHaveBeenCalled();
  });

  it("server action reports a friendly error if the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    dataMock.seedSampleData.mockRejectedValueOnce(new Error("db down"));
    expect(await generateSampleData()).toEqual({ ok: false, error: "Couldn't create sample data. Please try again." });
  });
});
