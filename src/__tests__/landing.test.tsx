// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import Home from "@/app/page";

afterEach(cleanup);

describe("Landing page", () => {
  it("renders the hero headline", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Take absolute control of your cash flow." }),
    ).toBeTruthy();
  });

  it("has a navigation bar with logo, Features, Security, Login and Get Started", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["CalmOwe", "Features", "Security", "Login", "Get Started"]) {
      expect(within(nav).getAllByRole("link", { name }).length).toBeGreaterThan(0);
    }
  });

  it("links the hero button to the dashboard", () => {
    render(<Home />);
    const cta = screen.getByRole("link", { name: /open the dashboard/i });
    expect(cta.getAttribute("href")).toBe("/dashboard");
  });

  it("shows the three feature cards", () => {
    render(<Home />);
    for (const title of ["Bank-grade Security", "AI Financial Copilot", "Smart Debt Payoff"]) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeTruthy();
    }
  });

  it("has Features and Security sections that the nav links point to", () => {
    const { container } = render(<Home />);
    expect(container.querySelector("#features")).not.toBeNull();
    expect(container.querySelector("#security")).not.toBeNull();
  });

  it("renders a footer with the no-investment-advice notice", () => {
    render(<Home />);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText(/does not provide investment advice/i)).toBeTruthy();
  });

  it("contains no emojis (design rule)", () => {
    const { container } = render(<Home />);
    // Unicode classes (c), (R) and TM as pictographic; those are allowed typographic symbols.
    expect(container.textContent).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
  });
});
