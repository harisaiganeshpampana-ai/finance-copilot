import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Enforces project rule 3: API keys never appear in frontend code.

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const files = walk(SRC)
  .filter((f) => !f.includes(`${sep}__tests__${sep}`))
  .map((f) => ({ path: relative(SRC, f).split(sep).join("/"), text: readFileSync(f, "utf8") }));

const SERVER_ONLY = (p: string) => p.startsWith("lib/server/") || p.startsWith("app/api/");

describe("secret safety", () => {
  it("only server-only files read API keys from the environment", () => {
    const offenders = files.filter((f) => /process\.env\.[A-Z_]*(KEY|SECRET|TOKEN)/.test(f.text) && !SERVER_ONLY(f.path));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("no NEXT_PUBLIC_ variable is used for secrets", () => {
    const offenders = files.filter((f) => /NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN)/.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('no client component ("use client") imports server-only code', () => {
    const offenders = files.filter(
      (f) => /^\s*["']use client["']/.test(f.text) && /from\s+["']@\/lib\/server\//.test(f.text),
    );
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("server-only files are not marked as client components", () => {
    const offenders = files.filter((f) => SERVER_ONLY(f.path) && /^\s*["']use client["']/.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });
});
