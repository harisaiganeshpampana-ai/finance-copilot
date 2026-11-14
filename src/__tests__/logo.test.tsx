// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Logo } from "@/components/Logo";
import { LogoMark, MARK_ARC, MARK_BAR } from "@/components/LogoMark";
import * as appleIcon from "@/app/apple-icon";
import * as ogImage from "@/app/opengraph-image";

afterEach(cleanup);

const appDir = join(process.cwd(), "src", "app");

describe("Level C logo mark", () => {
  it("draws the C arc and the level bar", () => {
    const { container } = render(<LogoMark />);
    const paths = [...container.querySelectorAll("path")].map((p) => p.getAttribute("d"));
    expect(paths).toEqual([MARK_ARC, MARK_BAR]);
  });

  it("is hidden from screen readers when decorative, and labelled when given a title", () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    render(<LogoMark title="CalmOwe" />);
    expect(screen.getByRole("img", { name: "CalmOwe" })).toBeTruthy();
  });
});

describe("Logo", () => {
  it("shows the Level C mark next to the CalmOwe wordmark and links home", () => {
    const { container } = render(<Logo />);
    const link = screen.getByRole("link", { name: "CalmOwe" });
    expect(link.getAttribute("href")).toBe("/");
    expect(container.querySelector("[data-logo-mark]")).not.toBeNull();
    expect(container.querySelector(".lucide-activity")).toBeNull(); // old placeholder icon is gone
  });
});

describe("app icons", () => {
  it("favicon (icon.svg) uses the same Level C geometry", () => {
    const svg = readFileSync(join(appDir, "icon.svg"), "utf8");
    expect(svg).toContain(`d="${MARK_ARC}"`);
    expect(svg).toContain(`d="${MARK_BAR}"`);
  });

  it("the default Next.js favicon has been removed", () => {
    expect(() => readFileSync(join(appDir, "favicon.ico"))).toThrow();
  });

  it("home-screen icon and link preview image have the right sizes", () => {
    expect(appleIcon.size).toEqual({ width: 180, height: 180 });
    expect(appleIcon.contentType).toBe("image/png");
    expect(ogImage.size).toEqual({ width: 1200, height: 630 });
    expect(ogImage.alt).toContain("CalmOwe");
  });
});
