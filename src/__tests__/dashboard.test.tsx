// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

import DashboardLayout from "@/app/(app)/layout";
import Dashboard from "@/app/(app)/dashboard/page";
import { resetCurrencyForTests } from "@/components/currency/currency-store";

beforeAll(installBrowserStubs);

beforeEach(() => {
  window.localStorage.clear();
  resetCurrencyForTests();
});

afterEach(cleanup);

const chooseCurrency = (code: string) => {
  fireEvent.click(screen.getByRole("button", { name: /display currency/i }));
  act(() => {
    fireEvent.click(screen.getByRole("menuitemradio", { name: new RegExp(`^.?\\s*${code}`) }));
  });
};

const renderDashboard = () =>
  render(
    <DashboardLayout>
      <Dashboard />
    </DashboardLayout>,
  );

describe("Dashboard (/dashboard)", () => {
  it("shows the sidebar navigation", () => {
    renderDashboard();
    const nav = screen.getByRole("navigation", { name: "Dashboard" });
    for (const name of ["Overview", "Transactions", "AI Copilot", "Settings"]) {
      expect(within(nav).getByRole("link", { name })).toBeTruthy();
    }
    expect(within(nav).getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/settings");
    expect(within(nav).getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "MoneyPulse" }).getAttribute("href")).toBe("/");
  });

  it("greets the user and shows an account avatar", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back, Hari" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /account/i })).toBeTruthy();
  });

  it("shows three stat cards with the right figures", () => {
    renderDashboard();
    const balance = screen.getByRole("region", { name: "Total Balance" });
    expect(within(balance).getByText("$14,922.54")).toBeTruthy();
    expect(within(balance).getByTestId("balance-trend").textContent).toBe("+16.2%");
    expect(within(screen.getByRole("region", { name: "Income" })).getByText("$3,850.00")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Expenses" })).getByText("$1,767.46")).toBeTruthy();
  });

  it("shows the 7-day spending chart and its total", () => {
    renderDashboard();
    const chart = screen.getByRole("region", { name: "Spending" });
    expect(within(chart).getByText("$317.46")).toBeTruthy();
    expect(within(chart).getByRole("img", { name: /last 7 days/i })).toBeTruthy();
  });

  it("lists all 10 transactions in a table", () => {
    renderDashboard();
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(11); // header + 10
    expect(within(table).getByText("Acme Corp Payroll")).toBeTruthy();
  });

  it("has a Copilot input that does not send anything yet", () => {
    renderDashboard();
    const input = screen.getByLabelText("Ask the AI Copilot");
    const send = screen.getByRole("button", { name: "Send question" });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "Can I afford a $300 phone?" } });
    fireEvent.click(send);
    expect(screen.getByRole("status").textContent).toMatch(/isn't connected yet/i);
  });

  it("has a currency selector with USD, INR, EUR and GBP", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /display currency: us dollar/i }));
    const options = screen.getAllByRole("menuitemradio");
    expect(options.map((o) => o.textContent)).toEqual([
      "$USDUS Dollar",
      "₹INRIndian Rupee",
      "€EUREuro",
      "£GBPBritish Pound",
    ]);
    expect(options[0].getAttribute("aria-checked")).toBe("true");
  });

  it("updates stats, chart total and transactions instantly when the currency changes", () => {
    renderDashboard();
    const balance = () => screen.getByTestId("stat-total-balance").textContent;
    const income = () => screen.getByTestId("stat-income").textContent;
    const expenses = () => screen.getByTestId("stat-expenses").textContent;
    const spent = () => within(screen.getByRole("region", { name: "Spending" })).getByText(/total spent/).previousSibling?.textContent;
    const payroll = () => screen.getByText("Acme Corp Payroll").closest("tr")!.lastElementChild!.textContent;

    expect(balance()).toBe("$14,922.54");

    chooseCurrency("INR");
    expect(balance()).toBe("₹12,46,032.09");
    expect(income()).toBe("₹3,21,475.00");
    expect(expenses()).toBe("₹1,47,582.91");
    expect(spent()).toBe("₹26,507.91");
    expect(payroll()).toBe("+₹2,71,375.00");
    expect(screen.getByRole("img", { name: /in INR/ })).toBeTruthy();

    chooseCurrency("EUR");
    expect(balance()).toBe("€13,728.74");
    expect(payroll()).toBe("+€2,990.00");

    chooseCurrency("GBP");
    expect(balance()).toBe("£11,788.81");
    expect(spent()).toBe("£250.79");

    chooseCurrency("USD");
    expect(balance()).toBe("$14,922.54");
  });

  it("remembers the chosen currency", () => {
    renderDashboard();
    chooseCurrency("INR");
    expect(window.localStorage.getItem("moneypulse.currency")).toBe("INR");
  });

  it("contains no emojis (design rule)", () => {
    const { container } = renderDashboard();
    expect(container.textContent).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
  });
});
