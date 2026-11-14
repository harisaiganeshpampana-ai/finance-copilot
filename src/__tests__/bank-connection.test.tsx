// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ refresh: vi.fn() }) }));

// Stand-in for the Plaid Link SDK: "opening" Plaid reports success (or exit), the way Plaid
// Sandbox does after logging in with user_good / pass_good.
const plaid = vi.hoisted(() => ({ outcome: "success" as "success" | "exit", open: vi.fn(), lastToken: "" }));
vi.mock("react-plaid-link", () => ({
  usePlaidLink: (config: { token: string; onSuccess: (publicToken: string, metadata: unknown) => void; onExit: () => void }) => {
    plaid.lastToken = config.token;
    return {
      ready: true,
      open: () => {
        plaid.open();
        if (plaid.outcome === "success") {
          config.onSuccess("public-sandbox-123e4567", {
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

import { disconnectBank, getBankConnectionStatus } from "@/app/(app)/bank-actions";
import AppLayout from "@/app/(app)/layout";
import { resetBankForTests } from "@/components/bank/bank-store";
import { exchangeBody } from "@/components/bank/ConnectBankModal";
import { resetCurrencyForTests } from "@/components/currency/currency-store";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MOCK_FINANCIAL_DATA } from "@/data/mockTransactions";

let fetchMock: ReturnType<typeof vi.fn>;
const respond = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const PLATYPUS = { name: "First Platypus Bank", account: "Plaid Checking", last4: "0000", mode: "sandbox", connectedAt: "2026-11-14T00:00:00Z" };

beforeAll(installBrowserStubs);
beforeEach(() => {
  window.localStorage.clear();
  resetCurrencyForTests();
  resetBankForTests();
  plaid.outcome = "success";
  plaid.open.mockClear();
  vi.mocked(getBankConnectionStatus).mockResolvedValue(null);
  vi.mocked(disconnectBank).mockResolvedValue({ ok: true });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
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
  it("has a prominent Connect Bank button in the sidebar and the agreed security message", () => {
    renderApp();
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
    openModal();
    expect(screen.getByRole("dialog", { name: "Securely connect your bank" })).toBeTruthy();
    expect(dialog().getByText("CalmOwe uses bank-grade encryption and read-only access.")).toBeTruthy();
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
  });
});

describe("Plaid flow", () => {
  it("creates a link token, opens Plaid, exchanges the public token, then closes with a success toast", async () => {
    respond({ mode: "plaid", linkToken: "link-sandbox-abc", env: "sandbox" });
    respond({ ok: true, bank: PLATYPUS });
    renderApp();
    openModal();
    await clickConnect();

    expect(fetchMock.mock.calls[0]).toEqual(["/api/plaid/create_link_token", { method: "POST" }]);
    expect(plaid.lastToken).toBe("link-sandbox-abc");
    expect(plaid.open).toHaveBeenCalled();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/plaid/exchange_public_token");
    expect(JSON.parse(init.body as string)).toEqual({
      public_token: "public-sandbox-123e4567",
      institution: { name: "First Platypus Bank" },
      account: { name: "Plaid Checking", mask: "0000" },
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((await screen.findAllByText("Bank connected successfully!")).length).toBeGreaterThan(0);
    expect(sidebar().getByText("First Platypus Bank")).toBeTruthy();
    expect(sidebar().getByText(/Plaid Checking •••• 0000 · Sandbox/)).toBeTruthy();
    expect(screen.getByTestId("data-source-label").textContent).toBe("Live Data Connected");
  });

  it("shows an error in the modal if the server can't finish the exchange", async () => {
    respond({ mode: "plaid", linkToken: "link-sandbox-abc", env: "sandbox" });
    respond({ error: "Couldn't finish connecting your bank. Please try again." }, 502);
    renderApp();
    openModal();
    await clickConnect();
    expect(await dialog().findByRole("alert")).toBeTruthy();
    expect(dialog().getByRole("alert").textContent).toMatch(/couldn't finish/i);
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
  });

  it("returns to the modal with a note if the user closes Plaid", async () => {
    plaid.outcome = "exit";
    respond({ mode: "plaid", linkToken: "link-sandbox-abc", env: "sandbox" });
    renderApp();
    openModal();
    await clickConnect();
    expect(await dialog().findByText(/Connection cancelled/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no exchange
  });

  it("shows the server's message if the connection can't start", async () => {
    respond({ error: "Couldn't start the bank connection. Please try again." }, 502);
    renderApp();
    openModal();
    await clickConnect();
    await waitFor(() => expect(dialog().getByRole("alert").textContent).toMatch(/couldn't start/i));
  });
});

describe("saved connection (MongoDB)", () => {
  it("shows the user's saved bank on load, on any device", async () => {
    vi.mocked(getBankConnectionStatus).mockResolvedValue(PLATYPUS as never);
    renderApp();
    expect(await sidebar().findByText("First Platypus Bank")).toBeTruthy();
    expect(screen.getByTestId("data-source-label").textContent).toBe("Live Data Connected");
  });

  it("Disconnect revokes on the server and returns to Demo data", async () => {
    vi.mocked(getBankConnectionStatus).mockResolvedValue(PLATYPUS as never);
    renderApp();
    await sidebar().findByText("First Platypus Bank");
    await act(async () => {
      fireEvent.click(sidebar().getByRole("button", { name: "Disconnect" }));
    });
    expect(disconnectBank).toHaveBeenCalled();
    expect(sidebar().getByRole("button", { name: "Connect Bank" })).toBeTruthy();
    expect(screen.getByTestId("data-source-pill").textContent).toBe("Demo data");
  });
});

describe("demo mode (no Plaid keys, e.g. local development)", () => {
  it("simulates a connection, closes the modal and shows the success toast", async () => {
    respond({ mode: "demo" });
    renderApp();
    openModal();
    await clickConnect();
    expect(plaid.open).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
    expect((await screen.findAllByText("Bank connected successfully!")).length).toBeGreaterThan(0);
    expect(sidebar().getByText("Meridian Bank")).toBeTruthy();
    expect(screen.getByTestId("data-source-pill").textContent).toContain("Demo");
  });
});

describe("exchangeBody", () => {
  it("sends only the public token and display details", () => {
    expect(exchangeBody("public-sandbox-1", { institution: null, accounts: [] })).toEqual({
      public_token: "public-sandbox-1",
      institution: { name: null },
      account: { name: null, mask: null },
    });
  });

  it("contains no emojis in the modal (design rule)", () => {
    renderApp();
    openModal();
    expect(screen.getByRole("dialog").textContent).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
  });
});
