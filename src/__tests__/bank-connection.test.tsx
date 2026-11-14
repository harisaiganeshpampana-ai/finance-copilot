// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

import AppLayout from "@/app/(app)/layout";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MOCK_FINANCIAL_DATA } from "@/data/mockTransactions";

// The dashboard as it renders for a user whose data is the original mock data.
const Dashboard = () => <DashboardView data={MOCK_FINANCIAL_DATA} />;
import { resetBankForTests } from "@/components/bank/bank-store";
import { resetCurrencyForTests } from "@/components/currency/currency-store";

beforeAll(installBrowserStubs);
beforeEach(() => {
  window.localStorage.clear();
  resetCurrencyForTests();
  resetBankForTests();
});
afterEach(cleanup);

const renderApp = () =>
  render(
    <AppLayout>
      <Dashboard />
    </AppLayout>,
  );

const sidebar = () => within(screen.getByTestId("sidebar-bank"));
const openModal = () => fireEvent.click(sidebar().getByRole("button", { name: "Connect Bank" }));

describe("Connect Bank flow", () => {
  it("replaces the old Demo mode note with a Connect Bank button", () => {
    renderApp();
    expect(screen.queryByText("Demo mode")).toBeNull();
    expect(sidebar().getByRole("button", { name: "Connect Bank" })).toBeTruthy();
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
  });

  it("opens a modal explaining why connecting is safe", () => {
    renderApp();
    openModal();
    const dialog = screen.getByRole("dialog", { name: "Connect your bank securely" });
    for (const point of ["Bank-grade encryption", "Read-only access", "Your login stays private", "Disconnect anytime"]) {
      expect(within(dialog).getByText(point)).toBeTruthy();
    }
    const cta = within(dialog).getByRole("button", { name: "Continue to Secure Login" });
    expect(document.activeElement).toBe(cta); // focus moves into the dialog
  });

  it("closes without connecting via Cancel, the close button, or Escape", () => {
    renderApp();
    openModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    openModal();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    openModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
  });

  it("connects (demo): closes the modal, shows a toast, a Synced badge and Live Data", async () => {
    renderApp();
    openModal();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Continue to Secure Login" }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("Bank connected successfully (Demo)")).toBeTruthy();
    expect(sidebar().getByText("Meridian Bank")).toBeTruthy();
    expect(sidebar().getByText("Synced")).toBeTruthy();
    expect(sidebar().queryByRole("button", { name: "Connect Bank" })).toBeNull();
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Live Data");
    expect(window.localStorage.getItem("calmowe.bankConnected")).toBe("true");
  });

  it("can disconnect and go back to Demo data", () => {
    renderApp();
    openModal();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Continue to Secure Login" }));
    });
    act(() => {
      fireEvent.click(sidebar().getByRole("button", { name: "Disconnect" }));
    });
    expect(sidebar().getByRole("button", { name: "Connect Bank" })).toBeTruthy();
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
  });

  it("contains no emojis in the modal (design rule)", () => {
    renderApp();
    openModal();
    expect(screen.getByRole("dialog").textContent).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
  });
});
