// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";

vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));

import AppLayout from "@/app/(app)/layout";
import SettingsPage from "@/app/(app)/settings/page";
import { resetCurrencyForTests } from "@/components/currency/currency-store";

beforeAll(installBrowserStubs);
beforeEach(() => {
  window.localStorage.clear();
  resetCurrencyForTests();
});
afterEach(cleanup);

const renderSettings = () =>
  render(
    <AppLayout>
      <SettingsPage />
    </AppLayout>,
  );

describe("Settings page (/settings)", () => {
  it("highlights Settings in the sidebar", () => {
    renderSettings();
    const nav = screen.getByRole("navigation", { name: "Dashboard" });
    expect(within(nav).getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBeNull();
    expect(within(nav).getByRole("link", { name: "Transactions" }).getAttribute("href")).toBe("/dashboard#transactions");
  });

  it("shows all sections", () => {
    renderSettings();
    for (const name of ["Profile", "Plan and billing", "Preferences", "Notifications", "Danger Zone"]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeTruthy();
      // Each section is a landmark labelled by its heading (ids must not contain spaces).
      expect(screen.getByRole("region", { name })).toBeTruthy();
    }
  });

  it("shows the current plan and all three plans with upgrade options", () => {
    renderSettings();
    const billing = within(screen.getByRole("region", { name: "Plan and billing" }));
    expect(billing.getByTestId("current-plan").textContent).toContain("Basic");
    expect(billing.getByRole("group", { name: "Basic plan" }).textContent).toContain("Current plan");
    expect(billing.getByTestId("settings-price-pro").textContent).toBe("$9/mo");
    expect(billing.getByTestId("settings-price-enterprise").textContent).toBe("Custom");
    expect(billing.getByRole("button", { name: "Upgrade to Pro" })).toBeTruthy();
    expect(billing.getByRole("button", { name: "Contact sales" })).toBeTruthy();
    expect(billing.getByRole("link", { name: /compare all plans/i }).getAttribute("href")).toBe("/pricing");
  });

  it("upgrade buttons show 'Checkout coming soon'", async () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    expect(await screen.findByText("Checkout coming soon")).toBeTruthy();
  });

  it("plan prices follow the selected currency (₹499)", () => {
    renderSettings();
    act(() => {
      fireEvent.click(within(screen.getByRole("radiogroup", { name: "Base Currency" })).getByRole("radio", { name: /INR/ }));
    });
    expect(screen.getByTestId("settings-price-pro").textContent).toBe("₹499/mo");
  });

  it("has editable profile fields and an Upload button", () => {
    renderSettings();
    const name = screen.getByLabelText("Full Name") as HTMLInputElement;
    const email = screen.getByLabelText("Email Address") as HTMLInputElement;
    expect(name.value).toBe("Pampana Hari Sai Ganesh");
    fireEvent.change(name, { target: { value: "Hari Ganesh" } });
    fireEvent.change(email, { target: { value: "hari@calmowe.app" } });
    expect(name.value).toBe("Hari Ganesh");
    expect(email.value).toBe("hari@calmowe.app");
    expect(screen.getByText("You have unsaved changes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();
  });

  it("previews a valid image and rejects files that are too large or the wrong type", () => {
    renderSettings();
    const input = screen.getByLabelText("Choose profile picture");
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 3 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText("Image must be 2 MB or smaller.")).toBeTruthy();

    fireEvent.change(input, { target: { files: [new File(["x"], "doc.pdf", { type: "application/pdf" })] } });
    expect(screen.getByText(/Use a PNG, JPG, GIF or WebP/)).toBeTruthy();

    fireEvent.change(input, { target: { files: [new File(["x"], "me.png", { type: "image/png" })] } });
    expect(screen.getByRole("img", { name: "Profile picture preview" })).toBeTruthy();
  });

  it("uses custom toggle switches that flip when clicked", () => {
    renderSettings();
    const switches = screen.getAllByRole("switch");
    expect(switches.map((s) => s.getAttribute("aria-label"))).toEqual([
      "Dark Mode",
      "Weekly Summary",
      "Large Transaction Alerts",
      "AI Copilot Tips",
    ]);
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);

    const tips = screen.getByRole("switch", { name: "AI Copilot Tips" });
    expect(tips.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(tips);
    expect(tips.getAttribute("aria-checked")).toBe("true");

    const dark = screen.getByRole("switch", { name: "Dark Mode" });
    fireEvent.click(dark);
    expect(dark.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Light theme is coming soon.")).toBeTruthy();
  });

  it("links Base Currency to the global currency (top bar updates too)", () => {
    renderSettings();
    const group = screen.getByRole("radiogroup", { name: "Base Currency" });
    act(() => {
      fireEvent.click(within(group).getByRole("radio", { name: /INR/ }));
    });
    expect(within(group).getByRole("radio", { name: /INR/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("button", { name: /display currency: indian rupee/i })).toBeTruthy();
    expect(window.localStorage.getItem("calmowe.currency")).toBe("INR");
  });

  it("saves valid changes and shows a success toast", async () => {
    renderSettings();
    fireEvent.click(screen.getByRole("switch", { name: "Weekly Summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Settings saved")).toBeTruthy();
    expect(await screen.findByText("All changes saved")).toBeTruthy();
  });

  it("shows field errors from server validation", async () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(await screen.findByText("Couldn't save settings")).toBeTruthy();
    expect(screen.getByLabelText("Email Address").getAttribute("aria-invalid")).toBe("true");
  });

  it("has a Delete Account button that does not delete anything in demo mode", async () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    expect(await screen.findByText("Account deletion isn't available yet")).toBeTruthy();
  });

  it("contains no emojis (design rule)", () => {
    const { container } = renderSettings();
    expect(container.textContent).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
  });
});
