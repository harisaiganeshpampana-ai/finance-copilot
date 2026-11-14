import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jwtMock = vi.hoisted(() => ({ getToken: vi.fn() }));
vi.mock("next-auth/jwt", () => jwtMock);

import { NextRequest } from "next/server";
import { proxy, config as proxyConfig } from "@/proxy";
import {
  authorizeCredentials,
  MAX_LOGIN_ATTEMPTS,
  registerUser,
  resetLoginAttemptsForTests,
  type StoredUser,
  type UserStore,
} from "@/lib/auth/credentials";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isProtectedPath, loginRedirectUrl, PROTECTED_PREFIXES, safeCallbackUrl } from "@/lib/auth/redirect";
import { parseLoginCredentials, validateSignup } from "@/lib/auth/validation";
import { connectToDatabase, DatabaseNotConfiguredError } from "@/lib/server/db";

/** In-memory user store standing in for MongoDB. */
function memoryStore(initial: StoredUser[] = []) {
  const users = [...initial];
  const store: UserStore = {
    findByEmail: vi.fn(async (email: string) => users.find((u) => u.email === email) ?? null),
    create: vi.fn(async ({ name, email, passwordHash }) => {
      const user = { id: `u${users.length + 1}`, name, email, passwordHash };
      users.push(user);
      return { id: user.id, name, email };
    }),
    upsertOAuthUser: vi.fn(async ({ name, email }) => {
      const existing = users.find((u) => u.email === email);
      if (existing) return { id: existing.id, name: existing.name, email: existing.email };
      const user = { id: `u${users.length + 1}`, name, email, passwordHash: null };
      users.push(user);
      return { id: user.id, name, email };
    }),
  };
  return { store, users };
}

beforeEach(() => resetLoginAttemptsForTests());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("validateSignup (server-side)", () => {
  const valid = { name: "  Hari Sai Ganesh ", email: " Hari@Example.com ", password: "calmowe123" };

  it("accepts valid input and normalizes name and email", () => {
    expect(validateSignup(valid)).toEqual({
      ok: true,
      data: { name: "Hari Sai Ganesh", email: "hari@example.com", password: "calmowe123" },
    });
  });

  it.each([
    ["missing name", { ...valid, name: "" }, "name"],
    ["name with newline", { ...valid, name: "Hari\nG" }, "name"],
    ["long name", { ...valid, name: "a".repeat(101) }, "name"],
    ["bad email", { ...valid, email: "hari@" }, "email"],
    ["short password", { ...valid, password: "abc123" }, "password"],
    ["password without a number", { ...valid, password: "onlyletters" }, "password"],
    ["password without a letter", { ...valid, password: "12345678" }, "password"],
    ["password over 72 bytes", { ...valid, password: `a1${"x".repeat(80)}` }, "password"],
  ])("rejects %s", (_label, input, field) => {
    const r = validateSignup(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field as "name"]).toBeTruthy();
  });

  it("rejects requests that aren't objects", () => {
    expect(validateSignup(null)).toEqual({ ok: false, errors: { form: "Invalid request." } });
    expect(validateSignup("x")).toEqual({ ok: false, errors: { form: "Invalid request." } });
  });
});

describe("parseLoginCredentials", () => {
  it("normalizes valid input and rejects malformed input", () => {
    expect(parseLoginCredentials({ email: " A@B.co ", password: "pw" })).toEqual({ email: "a@b.co", password: "pw" });
    expect(parseLoginCredentials({ email: "nope", password: "pw" })).toBeNull();
    expect(parseLoginCredentials({ email: "a@b.co", password: "" })).toBeNull();
    expect(parseLoginCredentials({ email: "a@b.co", password: 123 })).toBeNull();
    expect(parseLoginCredentials(undefined)).toBeNull();
  });
});

describe("password hashing (bcryptjs)", () => {
  it("never stores the plain password and verifies correctly", async () => {
    const hash = await hashPassword("calmowe123");
    expect(hash).not.toBe("calmowe123");
    expect(hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
    expect(await verifyPassword("calmowe123", hash)).toBe(true);
    expect(await verifyPassword("wrong-pass1", hash)).toBe(false);
  });
});

describe("registerUser", () => {
  it("hashes the password before saving and never returns it", async () => {
    const { store, users } = memoryStore();
    const result = await registerUser({ name: "Hari", email: "Hari@Example.com", password: "calmowe123" }, store);
    expect(result).toEqual({ ok: true, user: { id: "u1", name: "Hari", email: "hari@example.com" } });
    expect(users[0].passwordHash).not.toBe("calmowe123");
    expect(await verifyPassword("calmowe123", users[0].passwordHash!)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("calmowe123");
  });

  it("rejects a duplicate email", async () => {
    const { store } = memoryStore([{ id: "u1", name: "Hari", email: "hari@example.com", passwordHash: "x" }]);
    const result = await registerUser({ name: "Other", email: "hari@example.com", password: "calmowe123" }, store);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toMatch(/already exists/);
    expect(store.create).not.toHaveBeenCalled();
  });

  it("does not touch the database when input is invalid", async () => {
    const { store } = memoryStore();
    expect((await registerUser({ name: "", email: "x", password: "1" }, store)).ok).toBe(false);
    expect(store.findByEmail).not.toHaveBeenCalled();
  });

  it("explains when the database isn't configured, and handles duplicate-key races", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const input = { name: "Hari", email: "hari@example.com", password: "calmowe123" };
    const notConfigured: UserStore = {
      findByEmail: async () => {
        throw new DatabaseNotConfiguredError();
      },
      create: async () => ({ id: "", name: "", email: "" }),
      upsertOAuthUser: async () => ({ id: "", name: "", email: "" }),
    };
    const r1 = await registerUser(input, notConfigured);
    expect(r1.ok === false && r1.errors.form).toMatch(/isn't available yet/);

    const race: UserStore = {
      findByEmail: async () => null,
      create: async () => {
        throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
      },
      upsertOAuthUser: async () => ({ id: "", name: "", email: "" }),
    };
    const r2 = await registerUser(input, race);
    expect(r2.ok === false && r2.errors.email).toMatch(/already exists/);
  });
});

describe("authorizeCredentials (NextAuth Credentials provider)", () => {
  const seeded = async () =>
    memoryStore([{ id: "u1", name: "Hari", email: "hari@example.com", passwordHash: await hashPassword("calmowe123") }]);

  it("returns the user (without the password) for correct credentials", async () => {
    const { store } = await seeded();
    const user = await authorizeCredentials({ email: "HARI@example.com", password: "calmowe123" }, store);
    expect(user).toEqual({ id: "u1", name: "Hari", email: "hari@example.com" });
  });

  it("returns null for a wrong password, an unknown email, or malformed input", async () => {
    const { store } = await seeded();
    expect(await authorizeCredentials({ email: "hari@example.com", password: "wrong1234" }, store)).toBeNull();
    expect(await authorizeCredentials({ email: "nobody@example.com", password: "calmowe123" }, store)).toBeNull();
    expect(await authorizeCredentials({ email: "not-an-email", password: "x" }, store)).toBeNull();
  });

  it("blocks repeated attempts for the same email (brute-force protection)", async () => {
    const { store } = await seeded();
    const findByEmail = vi.spyOn(store, "findByEmail");
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      await authorizeCredentials({ email: "hari@example.com", password: "wrong1234" }, store);
    }
    findByEmail.mockClear();
    expect(await authorizeCredentials({ email: "hari@example.com", password: "calmowe123" }, store)).toBeNull();
    expect(findByEmail).not.toHaveBeenCalled();
  }, 30_000); // bcrypt is deliberately slow; 10 real password checks take several seconds
});

describe("redirect helpers", () => {
  it("only allows same-site callback URLs", () => {
    expect(safeCallbackUrl("/copilot")).toBe("/copilot");
    expect(safeCallbackUrl("/settings?tab=billing")).toBe("/settings?tab=billing");
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "/login", "/signup"]) {
      expect(safeCallbackUrl(bad)).toBe("/dashboard");
    }
  });

  it("knows which paths are protected", () => {
    for (const p of ["/dashboard", "/copilot", "/settings", "/dashboard/x"]) expect(isProtectedPath(p)).toBe(true);
    for (const p of ["/", "/pricing", "/login", "/signup", "/terms", "/dashboards"]) expect(isProtectedPath(p)).toBe(false);
  });

  it("builds a login URL that returns to the requested page", () => {
    expect(loginRedirectUrl("https://calmowe.com/copilot?x=1").toString()).toBe(
      "https://calmowe.com/login?callbackUrl=%2Fcopilot%3Fx%3D1",
    );
  });
});

describe("proxy (route protection)", () => {
  const request = (path: string) => new NextRequest(new URL(path, "https://calmowe.com"));

  it("redirects visitors without a session to /login with a callback", async () => {
    jwtMock.getToken.mockResolvedValueOnce(null);
    const res = await proxy(request("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://calmowe.com/login?callbackUrl=%2Fdashboard");
  });

  it("lets logged-in users through", async () => {
    jwtMock.getToken.mockResolvedValueOnce({ sub: "u1", email: "hari@example.com" });
    const res = await proxy(request("/copilot"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("fails closed (redirects to /login) if the session can't be read, e.g. missing secret", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    jwtMock.getToken.mockRejectedValueOnce(new Error("NO_SECRET"));
    const res = await proxy(request("/settings"));
    expect(res.headers.get("location")).toBe("https://calmowe.com/login?callbackUrl=%2Fsettings");
  });

  it("protects /dashboard, /copilot and /settings, matching the shared list", () => {
    expect(proxyConfig.matcher).toEqual(PROTECTED_PREFIXES.map((p) => `${p}/:path*`));
  });
});

describe("connectToDatabase", () => {
  it("throws a clear error when MONGODB_URI isn't set", async () => {
    vi.stubEnv("MONGODB_URI", "");
    await expect(connectToDatabase()).rejects.toBeInstanceOf(DatabaseNotConfiguredError);
  });
});
