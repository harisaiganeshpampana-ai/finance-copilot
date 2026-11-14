// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { installBrowserStubs } from "./test-setup";
import Home from "@/app/page";
import PricingPage from "@/app/pricing/page";
import TermsPage from "@/app/terms/page";
import PrivacyPage from "@/app/privacy/page";
import { resetCurrencyForTests } from "@/components/currency/currency-store";

beforeAll(installBrowserStubs);
beforeEach(() => {
  window.localStorage.clear();
  resetCurrencyForTests();
});
afterEach(cleanup);

describe("navigation", () => {
  it("landing navbar has a Pricing link", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link", { name: "Pricing" })[0].getAttribute("href")).toBe("/pricing");
  });

  it("landing footer links to Terms of Service and Privacy Policy", () => {
    render(<Home />);
    const footer = screen.getByRole("navigation", { name: "Footer" });
    expect(within(footer).getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/terms");
    expect(within(footer).getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy");
  });
});

describe("/pricing", () => {
  it("shows three tiers: Basic (free), Pro ($9/mo) and Enterprise (custom)", () => {
    render(<PricingPage />);
    for (const name of ["Basic", "Pro", "Enterprise"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
    expect(screen.getByTestId("price-basic").textContent).toBe("$0");
    expect(screen.getByTestId("price-pro").textContent).toBe("$9");
    expect(screen.getByTestId("price-enterprise").textContent).toBe("Custom");
    expect(screen.getByText("For teams and families.")).toBeTruthy();
  });

  it("lists the agreed features for each tier", () => {
    render(<PricingPage />);
    const basic = screen.getByRole("article", { name: "Basic" });
    expect(within(basic).getByText("Basic AI Copilot chat")).toBeTruthy();
    expect(within(basic).getByText("1 connected bank account")).toBeTruthy();
    const pro = screen.getByRole("article", { name: "Pro" });
    for (const f of ["Unlimited AI Copilot chat", "Unlimited connected bank accounts", "Debt payoff plans"]) {
      expect(within(pro).getByText(f)).toBeTruthy();
    }
  });

  it("marks Pro as most popular with a glowing border", () => {
    render(<PricingPage />);
    const pro = screen.getByRole("article", { name: "Pro" });
    expect(within(pro).getByText("Most popular")).toBeTruthy();
    expect(pro.parentElement?.getAttribute("data-glow")).toBe("true");
    expect(screen.getByRole("article", { name: "Basic" }).parentElement?.getAttribute("data-glow")).toBeNull();
  });

  it("switches prices to rupees (₹499/mo)", () => {
    render(<PricingPage />);
    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "₹ INR" }));
    });
    expect(screen.getByTestId("price-pro").textContent).toBe("₹499");
    expect(screen.getByTestId("price-basic").textContent).toBe("₹0");
  });

  it("Subscribe shows a 'Checkout coming soon' toast and charges nothing", async () => {
    render(<PricingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Subscribe to Pro" }));
    expect(await screen.findByText("Checkout coming soon")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Subscribe to Enterprise" }));
    expect((await screen.findAllByText("Checkout coming soon")).length).toBeGreaterThan(0);
  });

  it("the free plan links to the dashboard", () => {
    render(<PricingPage />);
    const basic = screen.getByRole("article", { name: "Basic" });
    expect(within(basic).getByRole("link", { name: "Get started" }).getAttribute("href")).toBe("/dashboard");
  });
});

describe("legal pages", () => {
  it("Terms of Service: last updated note and key clauses", () => {
    const { container } = render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeTruthy();
    expect(screen.getByTestId("last-updated").textContent).toBe("Last updated: November 2026");
    for (const h of ["Not financial advice", "AI features", "Connected financial accounts", "Subscriptions and payments"]) {
      expect(screen.getByRole("heading", { level: 2, name: new RegExp(h) })).toBeTruthy();
    }
    expect(container.textContent).toContain("does not provide official financial, investment, tax, legal or accounting advice");
    expect(container.textContent).toContain("AI-generated content can be inaccurate");
    expect(container.textContent).toContain("cannot move money");
  });

  it("Privacy Policy: last updated note, AI processing and data security", () => {
    const { container } = render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
    expect(screen.getByTestId("last-updated").textContent).toBe("Last updated: November 2026");
    for (const h of ["AI processing", "Financial data security", "Your rights and choices"]) {
      expect(screen.getByRole("heading", { level: 2, name: new RegExp(h) })).toBeTruthy();
    }
    expect(container.textContent).toContain("We do not sell your personal data");
    expect(container.textContent).toContain("not official financial advice");
    expect(container.textContent).toContain("Encryption of data in transit");
  });

  it("table of contents links match the sections", () => {
    const { container } = render(<PrivacyPage />);
    const toc = screen.getByRole("navigation", { name: "On this page" });
    for (const link of within(toc).getAllByRole("link")) {
      const id = link.getAttribute("href")!.slice(1);
      expect(container.querySelector(`section#${id}`)).not.toBeNull();
    }
  });

  it("contain no emojis (design rule)", () => {
    for (const Page of [PricingPage, TermsPage, PrivacyPage]) {
      const { container, unmount } = render(<Page />);
      expect(container.textContent).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
      unmount();
    }
  });
});
