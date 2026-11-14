// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/dashboard" }));

const sessionMock = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => sessionMock);

const waitlistMock = vi.hoisted(() => ({ joinWaitlist: vi.fn(), isOnWaitlist: vi.fn() }));
vi.mock("@/lib/server/waitlist", () => waitlistMock);

import { joinRealSyncWaitlist } from "@/app/(app)/dashboard/waitlist-actions";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { WaitlistCard } from "@/components/dashboard/WaitlistCard";
import { MOCK_FINANCIAL_DATA } from "@/data/mockTransactions";

const USER = { id: "64b0000000000000000000aa", name: "Hari", email: "hari@example.com" };

beforeAll(installBrowserStubs);
beforeEach(() => {
  sessionMock.getCurrentUser.mockResolvedValue(USER);
  waitlistMock.joinWaitlist.mockResolvedValue({ ok: true, alreadyJoined: false, email: "hari@example.com" });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Join Waitlist for Real Sync", () => {
  it("appears on the dashboard (with data and when empty)", () => {
    const { unmount } = render(<DashboardView data={MOCK_FINANCIAL_DATA} />);
    expect(screen.getByRole("button", { name: "Join Waitlist for Real Sync" })).toBeTruthy();
    unmount();
    render(<DashboardView data={{ transactions: [], openingBalanceCents: 0, asOf: "2026-11-14" }} />);
    expect(screen.getByRole("button", { name: "Join Waitlist for Real Sync" })).toBeTruthy();
  });

  it("joins via the server action and shows the confirmed state", async () => {
    render(<WaitlistCard />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Join Waitlist for Real Sync" }));
    });
    expect(waitlistMock.joinWaitlist).toHaveBeenCalledWith(USER);
    expect(screen.getByRole("status").textContent).toBe("You're on the waitlist");
    expect(screen.queryByRole("button", { name: "Join Waitlist for Real Sync" })).toBeNull();
  });

  it("shows the joined state immediately for users already on the list", () => {
    render(<WaitlistCard initiallyJoined />);
    expect(screen.getByRole("status").textContent).toBe("You're on the waitlist");
  });

  it("server action uses the session user (never browser input) and refuses when logged out", async () => {
    expect(await joinRealSyncWaitlist()).toEqual({ ok: true, alreadyJoined: false, email: "hari@example.com" });
    expect(waitlistMock.joinWaitlist).toHaveBeenCalledWith(USER);

    sessionMock.getCurrentUser.mockResolvedValueOnce(null);
    expect(await joinRealSyncWaitlist()).toEqual({ ok: false, error: "Please log in again." });
  });

  it("shows an error if saving fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    waitlistMock.joinWaitlist.mockRejectedValueOnce(new Error("db down"));
    render(<WaitlistCard />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Join Waitlist for Real Sync" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Couldn't join the waitlist. Please try again.");
  });
});
