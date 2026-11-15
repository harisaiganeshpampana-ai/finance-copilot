import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Regression (2026-11-15): the dashboard (a server component) called formatPeriod(), which
// lived in a "use client" file. Next.js only lets server code *render* client components; it
// can't call client functions, so /dashboard crashed in production. Component tests render
// everything in one place and can't see this, so check the source instead.

const SRC = join(process.cwd(), "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "__tests__" ? [] : files(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const isClient = (source: string) => /^\s*(["'])use client\1/m.test(source.replace(/^\s*\/\/.*$/gm, ""));

function resolve(spec: string): string | null {
  if (!spec.startsWith("@/")) return null;
  const base = join(SRC, spec.slice(2));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Server files that call (not render) a value imported from a "use client" module. */
function violations(): string[] {
  const found: string[] = [];
  for (const file of files(SRC)) {
    const source = readFileSync(file, "utf8");
    if (isClient(source)) continue;
    for (const m of source.matchAll(/^import\s+(?!type\b)\{([^}]+)\}\s+from\s+["']([^"']+)["']/gm)) {
      const target = resolve(m[2]);
      if (!target || !isClient(readFileSync(target, "utf8"))) continue;
      const names = m[1]
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n && !n.startsWith("type "))
        .map((n) => n.split(/\s+as\s+/).pop()!.trim());
      for (const name of names) {
        // Rendering <Name ... /> is fine; calling name(...) from the server is not.
        if (new RegExp(`(?<![\\w.<])${name}\\s*\\(`).test(source.replace(m[0], ""))) {
          found.push(`${relative(SRC, file)} calls ${name}() from client module ${m[2]}`);
        }
      }
    }
  }
  return found;
}

describe("server / client boundary", () => {
  it("server code never calls functions from 'use client' files", () => {
    expect(violations()).toEqual([]);
  });

  it("the date-range helper the dashboard uses is shared code, not client-only", () => {
    const dashboard = readFileSync(join(SRC, "components/dashboard/DashboardView.tsx"), "utf8");
    expect(isClient(dashboard)).toBe(false);
    expect(dashboard).toContain('import { formatPeriod } from "@/lib/statement-format"');
    expect(isClient(readFileSync(join(SRC, "lib/statement-format.ts"), "utf8"))).toBe(false);
  });
});
