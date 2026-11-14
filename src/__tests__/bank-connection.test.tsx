// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ refresh: vi.fn() }) }));

// Stand-in for the Plaid Link SDK: "opening" Plaid immediately reports success (or exit),
// the way the real Plaid Sandbox would after logging in with user_good / pass_good.
const plaid = vi.hoisted(() => ({
  outcome: "success" as "success" | "exit",
  open: vi.fn(),
  lastToken: "",
}));
vi.mock("react-plaid-link", () => ({
  usePlaidLink: (config: {
    token: string;
    onSuccess: (publicToken: string, metadata: unknown) => void;
    onExit: () => void;
  }) => {
    plaid.lastToken = config.token;
    return {
      ready: true,
      open: () => {
        plaid.open();
        if (plaid.outcome === "success") {
          config.onSuccess("public-sandbox-123", {
            institution: { name: "First Platypus Bank", institution_id: "ins_109508" },
            accounts: [{ id: "a1", name: "Plaid Checking", mask: "0000", type: "depository", subtype: "checking" }],
            link_session_id: "s1",
          });
        } else {
          config.onExit();
        }
      },
    };
  },
}));

import AppLayout from "@/app/(app)/layout";
import { resetBankForTests } from "@/components/bank/bank-store";
import { connectionFromPlaid } from "@/components/bank/ConnectBankModal";
import { resetCurrencyForTests } from "@/components/currency/currency-store";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MOCK_FINANCIAL_DATA } from "@/data/mockTransactions";

let fetchMock: ReturnType<typeof vi.fn>;
const linkTokenResponse = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

beforeAll(installBrowserStubs);
beforeEach(() => {
  window.localStorage.clear();
  resetCurrencyForTests();
  resetBankForTests();
  plaid.outcome = "success";
  plaid.open.mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderApp = () =>
  render(
    <AppLayout>
      <DashboardView data={MOCK_FINANCIAL_DATA} />
    </AppLayout>,
  );

const sidebar = () => within(screen.getByTestId("sidebar-bank"));
const openModal = () => fireEvent.click(sidebar().getByRole("button", { name: "Connect Bank" }));
const dialog = () => within(screen.getByRole("dialog"));
const clickConnect = async () => {
  await act(async () => {
    fireEvent.click(dialog().getByRole("button", { name: "Connect Bank" }));
  });
};

describe("Connect Bank modal", () => {
  it("explains why connecting is safe and has a Connect Bank button", () => {
    renderApp();
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
    openModal();
    expect(screen.getByRole("dialog", { name: "Connect your bank securely" })).toBeTruthy();
    for (const point of ["Bank-grade encryption", "Read-only access", "Your login stays private", "Disconnect anytime"]) {
      expect(dialog().getByText(point)).toBeTruthy();
    }
    expect(document.activeElement).toBe(dialog().getByRole("button", { name: "Connect Bank" }));
  });

  it("closes without connecting via Cancel, the close button, or Escape", () => {
    renderApp();
    for (const close of [
      () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })),
      () => fireEvent.click(screen.getByRole("button", { name: "Close" })),
      () => fireEvent.keyDown(document, { key: "Escape" }),
    ]) {
      openModal();
      close();
      expect(screen.queryByRole("dialog")).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
  });
});

describe("Plaid Sandbox mode (server has Plaid keys)", () => {
  it("opens Plaid Link with the server's link token and shows the connected bank", async () => {
    linkTokenResponse({ mode: "sandbox", linkToken: "link-sandbox-abc" });
    renderApp();
    openModal();
    await clickConnect();

    expect(fetchMock).toHaveBeenCalledWith("/api/plaid/link-token", { method: "POST" });
    expect(plaid.lastToken).toBe("link-sandbox-abc");
    expect(plaid.open).toHaveBeenCalled();
    expect(await dialog().findByRole("heading", { name: "Live Data Connected" })).toBeTruthy();
    expect(dialog().getByText(/Plaid Sandbox/)).toBeTruthy();

    fireEvent.click(dialog().getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sidebar().getByText("First Platypus Bank")).toBeTruthy();
    expect(sidebar().getByText("Synced")).toBeTruthy();
    expect(sidebar().getByText(/Plaid Checking •••• 0000 · Sandbox/)).toBeTruthy();
    expect(screen.getByTestId("data-source-label").textContent).toBe("Live Data Connected");
    expect(screen.getByTestId("data-source-pill").textContent).toContain("Sandbox");
  });

  it("returns to the modal with a note if the user closes Plaid", async () => {
    plaid.outcome = "exit";
    linkTokenResponse({ mode: "sandbox", linkToken: "link-sandbox-abc" });
    renderApp();
    openModal();
    await clickConnect();
    expect(await dialog().findByText(/Connection cancelled/)).toBeTruthy();
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
  });
});

describe("Demo mode (no Plaid keys yet)", () => {
  it("simulates a successful connection and shows Live Data Connected", async () => {
    linkTokenResponse({ mode: "demo" });
    renderApp();
    openModal();
    await clickConnect();
    expect(plaid.open).not.toHaveBeenCalled();
    expect(await dialog().findByRole("heading", { name: "Live Data Connected" }, { timeout: 3000 })).toBeTruthy();
    fireEvent.click(dialog().getByRole("button", { name: "Done" }));
    expect(sidebar().getByText("Meridian Bank")).toBeTruthy();
    expect(screen.getByTestId("data-source-pill").textContent).toContain("Demo");
    expect(window.localStorage.getItem("calmowe.bankConnection")).toContain("Meridian Bank");
  });

  it("can disconnect and go back to Demo data", async () => {
    linkTokenResponse({ mode: "demo" });
    renderApp();
    openModal();
    await clickConnect();
    await dialog().findByRole("heading", { name: "Live Data Connected" }, { timeout: 3000 });
    fireEvent.click(dialog().getByRole("button", { name: "Done" }));
    act(() => {
      fireEvent.click(sidebar().getByRole("button", { name: "Disconnect" }));
    });
    expect(sidebar().getByRole("button", { name: "Connect Bank" })).toBeTruthy();
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
  });
});

describe("errors", () => {
  it("shows the server's message if the connection can't start", async () => {
    linkTokenResponse({ error: "Couldn't start the bank connection. Please try again." }, 502);
    renderApp();
    openModal();
    await clickConnect();
    await waitFor(() => expect(dialog().getByRole("alert").textContent).toMatch(/couldn't start/i));
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
  });
});

describe("connectionFromPlaid", () => {
  it("uses the institution and first account, with safe fallbacks", () => {
    expect(
      connectionFromPlaid({
        institution: { name: "Tartan Bank", institution_id: "ins_1" },
        accounts: [{ id: "a", name: "Plaid Saving", mask: "1111", type: "depository", subtype: "savings", verification_status: null, class_type: null }],
      }),
    ).toEqual({ name: "Tartan Bank", account: "Plaid Saving", last4: "1111", mode: "sandbox" });
    expect(connectionFromPlaid({ institution: null, accounts: [] })).toEqual({
      name: "Connected bank",
      account: "Account",
      last4: "0000",
      mode: "sandbox",
    });
  });

  it("contains no emojis in the modal (design rule)", () => {
    renderApp();
    openModal();
    expect(screen.getByRole("dialog").textContent).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
  });
});
