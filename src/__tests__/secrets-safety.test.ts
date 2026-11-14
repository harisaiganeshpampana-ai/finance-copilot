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

// Files allowed to read secrets: server utilities, API routes, auth config and the proxy.
const SERVER_ONLY = (p: string) =>
  p.startsWith("lib/server/") || p.startsWith("app/api/") || p.startsWith("lib/auth/") || p === "proxy.ts";

// Auth modules that touch passwords, the database or secrets. `lib/auth/redirect.ts` and
// `lib/auth/validation.ts` are pure helpers and safe for the browser.
const SERVER_AUTH_IMPORT =
  /from\s+["']@\/(lib\/server\/|models\/|lib\/auth\/(credentials|options|password|session|user-store))["']?/;

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
    const offenders = files.filter((f) => /^\s*["']use client["']/.test(f.text) && SERVER_AUTH_IMPORT.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("server-action arguments (which include passwords at sign-up) are never logged", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toMatch(/logging:\s*\{\s*serverFunctions:\s*false\s*\}/);
  });

  it("Plaid credentials are only read on the server", () => {
    const readers = files.filter((f) => /env\.PLAID_(CLIENT_ID|SECRET)/.test(f.text)).map((f) => f.path);
    expect(readers).toEqual(["lib/server/plaid.ts"]);
  });

  it("Google OAuth credentials are only read by the auth config", () => {
    const readers = files.filter((f) => /process\.env\.GOOGLE_CLIENT_(ID|SECRET)|env\.GOOGLE_CLIENT_(ID|SECRET)/.test(f.text));
    expect(readers.map((f) => f.path)).toEqual(["lib/auth/options.ts"]);
  });

  it("NEXTAUTH_SECRET is only read by the auth config and the proxy", () => {
    const readers = files.filter((f) => f.text.includes("process.env.NEXTAUTH_SECRET")).map((f) => f.path).sort();
    expect(readers).toEqual(["lib/auth/options.ts", "proxy.ts"]);
  });

  it("server-only files are not marked as client components", () => {
    const offenders = files.filter((f) => SERVER_ONLY(f.path) && /^\s*["']use client["']/.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });
});
