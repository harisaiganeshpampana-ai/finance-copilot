// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import DashboardLayout from "@/app/dashboard/layout";
import Dashboard from "@/app/dashboard/page";

beforeAll(() => {
  // The chart measures its container; jsdom doesn't provide ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

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
    for (const name of ["Overview", "Transactions", "AI Copilot"]) {
      expect(within(nav).getByRole("link", { name })).toBeTruthy();
    }
    expect(within(nav).getByText("Settings")).toBeTruthy();
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

  it("contains no emojis (design rule)", () => {
    const { container } = renderDashboard();
    expect(container.textContent).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
  });
});
