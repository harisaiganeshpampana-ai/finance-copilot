// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CopilotBar } from "@/components/dashboard/CopilotBar";
import { resetCurrencyForTests } from "@/components/currency/currency-store";

let fetchMock: ReturnType<typeof vi.fn>;
let resolveFetch: (r: Response) => void;

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

const ask = (text: string) => {
  fireEvent.change(screen.getByLabelText("Ask the AI Copilot"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send question" }));
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Copilot chat", () => {
  it("no longer shows the 'not connected' notice", () => {
    render(<CopilotBar />);
    expect(screen.queryByText(/isn't connected yet/i)).toBeNull();
  });

  it("sends the question to /api/chat, shows a spinner, then the answer in a chat bubble", async () => {
    render(<CopilotBar />);
    ask("Can I afford a $300 phone?");

    // Question bubble + loading state right away
    expect(screen.getByText("Can I afford a $300 phone?").getAttribute("data-role")).toBe("user");
    expect(screen.getByRole("status").textContent).toMatch(/thinking/i);
    expect((screen.getByLabelText("Ask the AI Copilot") as HTMLInputElement).value).toBe("");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ message: "Can I afford a $300 phone?", history: [], currency: "USD" });

    resolveFetch(json({ reply: "Yes, you can afford it." }));
    const answer = await screen.findByText("Yes, you can afford it.");
    expect(answer.getAttribute("data-role")).toBe("assistant");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("includes earlier turns as history on follow-up questions", async () => {
    render(<CopilotBar />);
    ask("What's my balance?");
    resolveFetch(json({ reply: "$14,922.54." }));
    await screen.findByText("$14,922.54.");

    ask("And after rent?");
    const body = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(body.history).toEqual([
      { role: "user", content: "What's my balance?" },
      { role: "assistant", content: "$14,922.54." },
    ]);
  });

  it("shows the server's error message in an error bubble", async () => {
    render(<CopilotBar />);
    ask("Hi");
    resolveFetch(json({ error: "The Copilot isn't configured yet." }, 503));
    const err = await screen.findByText("The Copilot isn't configured yet.");
    expect(err.getAttribute("data-role")).toBe("error");
  });

  it("handles a network failure without crashing", async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    render(<CopilotBar />);
    ask("Hi");
    expect(await screen.findByText(/couldn't reach the copilot/i)).toBeTruthy();
  });

  it("can clear the conversation", async () => {
    render(<CopilotBar />);
    ask("Hi");
    resolveFetch(json({ reply: "Hello." }));
    await screen.findByText("Hello.");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(screen.queryByText("Hello.")).toBeNull());
  });
});
