import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BankConnectionStore,
  connectBank,
  disconnectBankForUser,
  getBankConnection,
  parseExchangeRequest,
  PLAID_TOKEN_SELECT,
  type StoredBankConnection,
} from "@/lib/server/bank-connection";
import { decryptSecret, encryptSecret, encryptionKey, EncryptionKeyMissingError } from "@/lib/server/crypto";
import type { PlaidApi } from "@/lib/server/plaid";

const USER = "64b0000000000000000000aa";
const OTHER = "64b0000000000000000000bb";
const ACCESS_TOKEN = "access-sandbox-de3ce8ef-33f8-452c-a685-8671031fc0f6";

beforeEach(() => vi.stubEnv("NEXTAUTH_SECRET", "test-nextauth-secret-for-encryption"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function fakePlaid(): PlaidApi & { item: { exchangePublicToken: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } } {
  return {
    link: { createToken: vi.fn(async () => ({ link_token: "link-sandbox-abc" })) },
    item: {
      exchangePublicToken: vi.fn(async () => ({ access_token: ACCESS_TOKEN, item_id: "item-1" })),
      remove: vi.fn(async () => ({})),
    },
  };
}

function memoryStore() {
  const rows = new Map<string, StoredBankConnection>();
  const store: BankConnectionStore = {
    save: vi.fn(async (userId: string, c: StoredBankConnection) => void rows.set(userId, c)),
    get: vi.fn(async (userId: string) => rows.get(userId) ?? null),
    clear: vi.fn(async (userId: string) => void rows.delete(userId)),
  };
  return { store, rows };
}

describe("encryption (AES-256-GCM)", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret(ACCESS_TOKEN);
    const b = encryptSecret(ACCESS_TOKEN);
    expect(a).not.toBe(b);
    expect(a).not.toContain(ACCESS_TOKEN);
    expect(a.startsWith("v1:")).toBe(true);
    expect(decryptSecret(a)).toBe(ACCESS_TOKEN);
  });

  it("detects tampering", () => {
    const parts = encryptSecret(ACCESS_TOKEN).split(":");
    parts[3] = Buffer.from("tampered!").toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("can't be decrypted with a different key", () => {
    const enc = encryptSecret(ACCESS_TOKEN);
    vi.stubEnv("NEXTAUTH_SECRET", "a-different-secret");
    expect(() => decryptSecret(enc)).toThrow();
  });

  it("prefers ENCRYPTION_KEY and validates it; errors with no key at all", () => {
    vi.stubEnv("ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    expect(encryptionKey()).toEqual(Buffer.alloc(32, 7));
    vi.stubEnv("ENCRYPTION_KEY", "dG9vLXNob3J0");
    expect(() => encryptionKey()).toThrow(/32 bytes/);
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    expect(() => encryptionKey()).toThrow(EncryptionKeyMissingError);
  });
});

describe("reading the connection from MongoDB (regression)", () => {
  it("selects the hidden token with '+' only, avoiding MongoDB's path-collision error", () => {
    expect(PLAID_TOKEN_SELECT).toBe("+plaid.accessTokenEncrypted");
    // "plaid" together with "+plaid.accessTokenEncrypted" makes MongoDB reject the query.
    expect(PLAID_TOKEN_SELECT.split(/\s+/)).not.toContain("plaid");
  });
});

describe("parseExchangeRequest", () => {
  it("accepts a public token and cleans display details", () => {
    expect(
      parseExchangeRequest({
        public_token: "public-sandbox-123",
        institution: { name: "  First Platypus Bank\n" },
        account: { name: "Plaid Checking", mask: "0000" },
      }),
    ).toEqual({ publicToken: "public-sandbox-123", name: "First Platypus Bank", account: "Plaid Checking", last4: "0000" });
  });

  it("uses safe fallbacks for missing or odd details", () => {
    expect(parseExchangeRequest({ public_token: "public-sandbox-1", account: { mask: "abcd" }, institution: { name: "x".repeat(200) } })).toEqual({
      publicToken: "public-sandbox-1",
      name: "x".repeat(80),
      account: "Account",
      last4: "0000",
    });
  });

  it("rejects requests without a valid public token", () => {
    for (const body of [null, "x", [], {}, { public_token: ACCESS_TOKEN }]) expect(parseExchangeRequest(body)).toBeNull();
  });
});

describe("connectBank", () => {
  it("exchanges the public token and stores the access token ENCRYPTED for that user", async () => {
    const plaid = fakePlaid();
    const { store, rows } = memoryStore();
    const bank = await connectBank(
      USER,
      { publicToken: "public-sandbox-123", name: "First Platypus Bank", account: "Plaid Checking", last4: "0000" },
      { plaid, env: "sandbox", store, now: new Date("2026-11-14T10:00:00Z") },
    );
    expect(plaid.item.exchangePublicToken).toHaveBeenCalledWith({ public_token: "public-sandbox-123" });

    const saved = rows.get(USER)!;
    expect(saved.accessTokenEncrypted).not.toContain(ACCESS_TOKEN);
    expect(decryptSecret(saved.accessTokenEncrypted)).toBe(ACCESS_TOKEN);
    expect(saved.itemId).toBe("item-1");
    expect(rows.has(OTHER)).toBe(false);

    expect(bank).toEqual({ name: "First Platypus Bank", account: "Plaid Checking", last4: "0000", mode: "sandbox", connectedAt: "2026-11-14T10:00:00.000Z" });
    expect(JSON.stringify(bank)).not.toContain(ACCESS_TOKEN);
  });

  it("does not save anything if the exchange fails", async () => {
    const plaid = fakePlaid();
    plaid.item.exchangePublicToken.mockRejectedValueOnce(new Error("INVALID_PUBLIC_TOKEN"));
    const { store } = memoryStore();
    await expect(
      connectBank(USER, { publicToken: "public-sandbox-1", name: "x", account: "y", last4: "0000" }, { plaid, env: "sandbox", store }),
    ).rejects.toThrow();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("rejects invalid user ids", async () => {
    await expect(
      connectBank("bad", { publicToken: "public-sandbox-1", name: "x", account: "y", last4: "0000" }, { plaid: fakePlaid(), env: "sandbox" }),
    ).rejects.toThrow("Invalid user id");
  });
});

describe("getBankConnection and disconnect", () => {
  const seeded = async () => {
    const { store, rows } = memoryStore();
    await connectBank(USER, { publicToken: "public-sandbox-1", name: "First Platypus Bank", account: "Plaid Checking", last4: "0000" }, { plaid: fakePlaid(), env: "sandbox", store });
    return { store, rows };
  };

  it("returns public details only (no tokens), and null for other users", async () => {
    const { store } = await seeded();
    const bank = await getBankConnection(USER, store);
    expect(bank).toMatchObject({ name: "First Platypus Bank", account: "Plaid Checking", last4: "0000", mode: "sandbox" });
    expect(Object.keys(bank!).sort()).toEqual(["account", "connectedAt", "last4", "mode", "name"]);
    expect(await getBankConnection(OTHER, store)).toBeNull();
  });

  it("revokes the access token at Plaid and clears the connection", async () => {
    const { store, rows } = await seeded();
    const plaid = fakePlaid();
    await disconnectBankForUser(USER, { plaid, store });
    expect(plaid.item.remove).toHaveBeenCalledWith({ access_token: ACCESS_TOKEN });
    expect(rows.has(USER)).toBe(false);
  });

  it("still clears the connection if Plaid revocation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, rows } = await seeded();
    const plaid = fakePlaid();
    plaid.item.remove.mockRejectedValueOnce(new Error("plaid down"));
    await disconnectBankForUser(USER, { plaid, store });
    expect(rows.has(USER)).toBe(false);
  });
});
