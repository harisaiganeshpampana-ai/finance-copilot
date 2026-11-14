// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";

vi.mock("next/navigation", () => ({ usePathname: () => "/copilot" }));

import AppLayout from "@/app/(app)/layout";
import CopilotPage from "@/app/(app)/copilot/page";
import { resetCurrencyForTests } from "@/components/currency/currency-store";

let fetchMock: ReturnType<typeof vi.fn>;
let resolveFetch: (r: Response) => void;

beforeAll(installBrowserStubs);
beforeEach(() => {
  window.localStorage.clear();
  resetCurrencyForTests();
  fetchMock = vi.fn(() => new Promise<Response>((resolve) => (resolveFetch = resolve)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <AppLayout>
      <CopilotPage />
    </AppLayout>,
  );

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sentBody = (i = 0) => JSON.parse((fetchMock.mock.calls[i] as [string, RequestInit])[1].body as string);
const input = () => screen.getByLabelText("Ask the AI Copilot") as HTMLTextAreaElement;

describe("/copilot page", () => {
  it("highlights AI Copilot in the sidebar", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Dashboard" });
    const link = within(nav).getByRole("link", { name: "AI Copilot" });
    expect(link.getAttribute("href")).toBe("/copilot");
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBeNull();
  });

  it("shows the header, a greeting and three suggestion chips when empty", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "CalmOwe Copilot" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Hi Hari, how can I help you with your money today?" })).toBeTruthy();
    for (const text of [
      "Can I afford a ₹5,000 purchase?",
      "Review my spending this week",
      "How do I pay off my debt faster?",
    ]) {
      expect(screen.getByRole("button", { name: text })).toBeTruthy();
    }
    expect(input()).toBeTruthy();
  });

  it("sends a suggestion chip to the AI, shows loading, then the answer bubble", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Can I afford a ₹5,000 purchase?" }));

    expect(fetchMock.mock.calls[0][0]).toBe("/api/chat");
    expect(sentBody()).toEqual({ message: "Can I afford a ₹5,000 purchase?", history: [], currency: "USD" });
    expect(screen.getByText("Can I afford a ₹5,000 purchase?").getAttribute("data-role")).toBe("user");
    expect(screen.getByRole("status").textContent).toMatch(/thinking/i);
    expect(screen.queryByRole("heading", { name: /how can I help/ })).toBeNull(); // empty state gone

    resolveFetch(json({ reply: "Yes. ₹5,000 is about $59.88, well within your $14,922.54 balance." }));
    const answer = await screen.findByText(/₹5,000 is about \$59\.88/);
    expect(answer.getAttribute("data-role")).toBe("assistant");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sends typed messages with Enter, keeps history, and Shift+Enter does not send", async () => {
    renderPage();
    fireEvent.change(input(), { target: { value: "What's my balance?" } });
    fireEvent.keyDown(input(), { key: "Enter", shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.keyDown(input(), { key: "Enter" });
    expect(sentBody().message).toBe("What's my balance?");
    expect(input().value).toBe("");
    resolveFetch(json({ reply: "$14,922.54." }));
    await screen.findByText("$14,922.54.");

    fireEvent.change(input(), { target: { value: "And after rent?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    expect(sentBody(1).history).toEqual([
      { role: "user", content: "What's my balance?" },
      { role: "assistant", content: "$14,922.54." },
    ]);
  });

  it("shows server errors in an error bubble and survives network failures", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review my spending this week" }));
    resolveFetch(json({ error: "The Copilot isn't configured yet." }, 503));
    expect((await screen.findByText("The Copilot isn't configured yet.")).getAttribute("data-role")).toBe("error");

    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    fireEvent.change(input(), { target: { value: "Hi" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(await screen.findByText(/couldn't reach the copilot/i)).toBeTruthy();
  });

  it("New chat returns to the empty state", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "How do I pay off my debt faster?" }));
    resolveFetch(json({ reply: "Pay the highest-interest balance first." }));
    await screen.findByText("Pay the highest-interest balance first.");
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /how can I help/ })).toBeTruthy());
  });

  it("contains no emojis (design rule)", () => {
    const { container } = renderPage();
    expect(container.textContent).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
  });
});
