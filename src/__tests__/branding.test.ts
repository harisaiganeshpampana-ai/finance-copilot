import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL, siteMetadata } from "@/lib/site";

describe("site metadata", () => {
  it("uses the final title and description", () => {
    expect(SITE_TITLE).toBe("CalmOwe | AI Financial Copilot");
    expect(SITE_DESCRIPTION).toBe(
      "Take absolute control of your cash flow with CalmOwe. Your AI-powered personal finance copilot.",
    );
    expect(siteMetadata.title).toEqual({ default: SITE_TITLE, template: "%s | CalmOwe" });
    expect(siteMetadata.description).toBe(SITE_DESCRIPTION);
  });

  it("points at the live domain calmowe.com", () => {
    expect(SITE_URL).toBe("https://calmowe.com");
    expect(String(siteMetadata.metadataBase)).toBe("https://calmowe.com/");
    expect(siteMetadata.openGraph).toMatchObject({ siteName: "CalmOwe", url: SITE_URL, title: SITE_TITLE });
    expect(siteMetadata.twitter).toMatchObject({ card: "summary_large_image", title: SITE_TITLE });
  });

  it("the root layout uses this metadata", () => {
    const layout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain("export const metadata: Metadata = siteMetadata;");
  });
});

describe("branding", () => {
  const SRC = join(process.cwd(), "src");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|svg|css)$/.test(name) ? [p] : [];
    });
  const sourceFiles = walk(SRC).filter((f) => !f.includes(`${sep}__tests__${sep}`));

  it("has no leftover old product names anywhere in the app", () => {
    const offenders = sourceFiles
      // "finance copilot" (with a space) is part of the tagline; only the old project id is banned.
      .filter((f) => /moneypulse|money pulse|finance-copilot/i.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it("the package is named calmowe", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.name).toBe("calmowe");
  });
});
