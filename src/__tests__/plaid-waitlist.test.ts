import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMock = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => sessionMock);

// Fake Plaid SDK client for the routes.
const fakePlaid = vi.hoisted(() => ({
  link: { createToken: vi.fn() },
  item: { exchangePublicToken: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/server/plaid", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/plaid")>()),
  createPlaidClient: () => fakePlaid,
}));

const connectMock = vi.hoisted(() => ({ connectBank: vi.fn() }));
vi.mock("@/lib/server/bank-connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/bank-connection")>()),
  connectBank: connectMock.connectBank,
}));

import { POST as createLinkTokenRoute } from "@/app/api/plaid/create_link_token/route";
import { POST as exchangeRoute } from "@/app/api/plaid/exchange_public_token/route";
import { isValidPublicToken, plaidConfig } from "@/lib/server/plaid";
import { isOnWaitlist, joinWaitlist, type WaitlistStore } from "@/lib/server/waitlist";

const USER = { id: "64b0000000000000000000aa", name: "Hari", email: "Hari@Example.com" };
const SECRET = "plaid-sandbox-secret-not-real";
const ACCESS_TOKEN = "access-sandbox-de3ce8ef-33f8-452c-a685-8671031fc0f6";
const exchange = (body: unknown) =>
  exchangeRoute(new Request("http://localhost/api/plaid/exchange_public_token", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const validBody = { public_token: "public-sandbox-123e4567", institution: { name: "First Platypus Bank" }, account: { name: "Plaid Checking", mask: "0000" } };

beforeEach(() => {
  sessionMock.getCurrentUser.mockResolvedValue(USER);
  vi.stubEnv("PLAID_CLIENT_ID", "client-123");
  vi.stubEnv("PLAID_SECRET", SECRET);
  vi.stubEnv("PLAID_ENV", "sandbox");
  fakePlaid.link.createToken.mockResolvedValue({ link_token: "link-sandbox-abc" });
  connectMock.connectBank.mockResolvedValue({ name: "First Platypus Bank", account: "Plaid Checking", last4: "0000", mode: "sandbox", connectedAt: "2026-11-14T00:00:00.000Z" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("plaidConfig", () => {
  const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;
  it("reads PLAID_CLIENT_ID, PLAID_SECRET and PLAID_ENV (sandbox by default)", () => {
    expect(plaidConfig(env({ PLAID_CLIENT_ID: "a", PLAID_SECRET: "b", PLAID_ENV: "sandbox" }))).toEqual({ clientId: "a", secret: "b", env: "sandbox" });
    expect(plaidConfig(env({ PLAID_CLIENT_ID: "a", PLAID_SECRET: "b" }))?.env).toBe("sandbox");
    expect(plaidConfig(env({ PLAID_CLIENT_ID: "a", PLAID_SECRET: "b", PLAID_ENV: "nonsense" }))?.env).toBe("sandbox");
    expect(plaidConfig(env({ PLAID_CLIENT_ID: "a", PLAID_SECRET: "b", PLAID_ENV: "production" }))?.env).toBe("production");
    expect(plaidConfig(env({ PLAID_CLIENT_ID: "a" }))).toBeNull();
  });

  it("recognizes Plaid public tokens", () => {
    expect(isValidPublicToken("public-sandbox-123e4567-e89b")).toBe(true);
    for (const bad of ["", "access-sandbox-1", "public-sandbox-<script>", 42, `public-sandbox-${"a".repeat(300)}`]) {
      expect(isValidPublicToken(bad)).toBe(false);
    }
  });
});

describe("POST /api/plaid/create_link_token", () => {
  it("requires a login", async () => {
    sessionMock.getCurrentUser.mockResolvedValueOnce(null);
    expect((await createLinkTokenRoute()).status).toBe(401);
    expect(fakePlaid.link.createToken).not.toHaveBeenCalled();
  });

  it("creates a Link token for the logged-in user with the Plaid SDK (secret never returned)", async () => {
    const res = await createLinkTokenRoute();
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ mode: "plaid", linkToken: "link-sandbox-abc", env: "sandbox" });
    expect(text).not.toContain(SECRET);
    expect(fakePlaid.link.createToken).toHaveBeenCalledWith(
      expect.objectContaining({ client_name: "CalmOwe", user: { client_user_id: USER.id }, products: ["transactions"] }),
    );
  });

  it("returns demo mode when Plaid keys aren't configured", async () => {
    vi.stubEnv("PLAID_SECRET", "");
    expect(await (await createLinkTokenRoute()).json()).toEqual({ mode: "demo" });
  });

  it("returns a friendly 502 if Plaid fails", async () => {
    fakePlaid.link.createToken.mockRejectedValueOnce(new Error("INVALID_API_KEYS"));
    const res = await createLinkTokenRoute();
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("INVALID_API_KEYS");
  });
});

describe("POST /api/plaid/exchange_public_token", () => {
  it("requires a login", async () => {
    sessionMock.getCurrentUser.mockResolvedValueOnce(null);
    expect((await exchange(validBody)).status).toBe(401);
    expect(connectMock.connectBank).not.toHaveBeenCalled();
  });

  it("exchanges and saves for the logged-in user, returning only public details", async () => {
    const res = await exchange(validBody);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, bank: expect.objectContaining({ name: "First Platypus Bank", last4: "0000" }) });
    expect(JSON.stringify(body)).not.toMatch(/access/i);
    const [userId, req, deps] = connectMock.connectBank.mock.calls[0];
    expect(userId).toBe(USER.id);
    expect(req).toEqual({ publicToken: "public-sandbox-123e4567", name: "First Platypus Bank", account: "Plaid Checking", last4: "0000" });
    expect(deps.env).toBe("sandbox");
  });

  it.each([
    ["invalid JSON", "{nope"],
    ["missing token", { institution: { name: "x" } }],
    ["not a public token", { public_token: ACCESS_TOKEN }],
    ["array", [1, 2]],
  ])("rejects %s with 400", async (_label, body) => {
    expect((await exchange(body)).status).toBe(400);
    expect(connectMock.connectBank).not.toHaveBeenCalled();
  });

  it("returns 503 when Plaid isn't configured", async () => {
    vi.stubEnv("PLAID_CLIENT_ID", "");
    expect((await exchange(validBody)).status).toBe(503);
  });

  it("returns a friendly 502 if the exchange fails", async () => {
    connectMock.connectBank.mockRejectedValueOnce(new Error("INVALID_PUBLIC_TOKEN"));
    const res = await exchange(validBody);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("INVALID_PUBLIC_TOKEN");
  });
});

describe("waitlist", () => {
  function memoryStore() {
    const entries = new Map<string, string>();
    const store: WaitlistStore = {
      isOnWaitlist: vi.fn(async (userId: string) => entries.has(userId)),
      add: vi.fn(async ({ userId, email }: { userId: string; email: string }) => {
        if (entries.has(userId)) return { created: false };
        entries.set(userId, email);
        return { created: true };
      }),
    };
    return { store, entries };
  }

  it("saves the user's email (normalized) and never creates duplicates", async () => {
    const { store, entries } = memoryStore();
    expect(await joinWaitlist(USER, store)).toEqual({ ok: true, alreadyJoined: false, email: "hari@example.com" });
    expect(await joinWaitlist(USER, store)).toEqual({ ok: true, alreadyJoined: true, email: "hari@example.com" });
    expect(entries.size).toBe(1);
    expect(await isOnWaitlist(USER.id, store)).toBe(true);
  });

  it("rejects accounts without a valid email", async () => {
    const { store } = memoryStore();
    expect((await joinWaitlist({ id: USER.id, email: null }, store)).ok).toBe(false);
    expect(store.add).not.toHaveBeenCalled();
  });
});
