import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMock = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => sessionMock);

import { POST as linkTokenRoute } from "@/app/api/plaid/link-token/route";
import { createSandboxLinkToken, PLAID_SANDBOX_URL, plaidCredentials } from "@/lib/server/plaid";
import { isOnWaitlist, joinWaitlist, type WaitlistStore } from "@/lib/server/waitlist";

const USER = { id: "64b0000000000000000000aa", name: "Hari", email: "Hari@Example.com" };
const SECRET = "plaid-sandbox-secret-not-real";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  sessionMock.getCurrentUser.mockResolvedValue(USER);
  vi.stubEnv("PLAID_CLIENT_ID", "client-123");
  vi.stubEnv("PLAID_SECRET", SECRET);
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ link_token: "link-sandbox-abc" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/plaid/link-token", () => {
  it("requires a login", async () => {
    sessionMock.getCurrentUser.mockResolvedValueOnce(null);
    const res = await linkTokenRoute();
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns demo mode when Plaid keys aren't configured", async () => {
    vi.stubEnv("PLAID_SECRET", "");
    expect(await (await linkTokenRoute()).json()).toEqual({ mode: "demo" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a Sandbox link token for the logged-in user, without exposing the secret", async () => {
    const res = await linkTokenRoute();
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ mode: "sandbox", linkToken: "link-sandbox-abc" });
    expect(text).not.toContain(SECRET);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sandbox.plaid.com/link/token/create");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      client_id: "client-123",
      secret: SECRET,
      client_name: "CalmOwe",
      user: { client_user_id: USER.id },
      products: ["transactions"],
    });
  });

  it("always uses Plaid Sandbox, even if PLAID_ENV says production", async () => {
    vi.stubEnv("PLAID_ENV", "production");
    await linkTokenRoute();
    expect((fetchMock.mock.calls[0] as [string])[0].startsWith(PLAID_SANDBOX_URL)).toBe(true);
  });

  it("returns a friendly 502 (no Plaid details) if Plaid fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error_code: "INVALID_API_KEYS" }), { status: 400 }));
    const res = await linkTokenRoute();
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toContain("INVALID_API_KEYS");
    expect(text).not.toContain(SECRET);
  });
});

describe("plaid helpers", () => {
  it("needs both PLAID_CLIENT_ID and PLAID_SECRET", () => {
    expect(plaidCredentials({ PLAID_CLIENT_ID: "a", PLAID_SECRET: "b" } as unknown as NodeJS.ProcessEnv)).toEqual({ clientId: "a", secret: "b" });
    expect(plaidCredentials({ PLAID_CLIENT_ID: "a" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("rejects a response without a link token", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await expect(createSandboxLinkToken(USER.id, { clientId: "a", secret: "b" })).rejects.toThrow(/link token failed/);
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

  it("saves the user's email (normalized) from their account", async () => {
    const { store, entries } = memoryStore();
    expect(await joinWaitlist(USER, store)).toEqual({ ok: true, alreadyJoined: false, email: "hari@example.com" });
    expect(entries.get(USER.id)).toBe("hari@example.com");
    expect(await isOnWaitlist(USER.id, store)).toBe(true);
  });

  it("never creates duplicates", async () => {
    const { store, entries } = memoryStore();
    await joinWaitlist(USER, store);
    expect(await joinWaitlist(USER, store)).toEqual({ ok: true, alreadyJoined: true, email: "hari@example.com" });
    expect(entries.size).toBe(1);
  });

  it("rejects accounts without a valid email and invalid user ids", async () => {
    const { store } = memoryStore();
    expect(await joinWaitlist({ id: USER.id, email: null }, store)).toEqual({
      ok: false,
      error: "Your account doesn't have a valid email address.",
    });
    await expect(joinWaitlist({ id: "bad", email: "a@b.co" }, store)).rejects.toThrow("Invalid user id");
    expect(store.add).not.toHaveBeenCalled();
  });
});
