// SERVER-ONLY. A user's connected bank (Plaid), stored on their MongoDB user document.
// The Plaid access token is encrypted before saving and never returned to the browser.
// Dependencies are injectable so this can be tested without Plaid or MongoDB.

import { decryptSecret, encryptSecret } from "@/lib/server/crypto";
import { exchangePublicToken, isValidPublicToken, type PlaidApi, type PlaidEnvName, removeItem } from "@/lib/server/plaid";
import { assertUserId } from "@/lib/server/transactions";

/** What the browser may see about a connection (no tokens). */
export type PublicBankConnection = {
  name: string;
  account: string;
  last4: string;
  mode: PlaidEnvName;
  connectedAt: string;
};

export type StoredBankConnection = PublicBankConnection & { accessTokenEncrypted: string; itemId: string };

export type BankConnectionStore = {
  save(userId: string, connection: StoredBankConnection): Promise<void>;
  get(userId: string): Promise<StoredBankConnection | null>;
  clear(userId: string): Promise<void>;
};

async function defaultStore(): Promise<BankConnectionStore> {
  const [{ Types }, { connectToDatabase }, { User }] = await Promise.all([
    import("mongoose"),
    import("@/lib/server/db"),
    import("@/models/User"),
  ]);
  return {
    async save(userId, c) {
      await connectToDatabase();
      await User.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $set: {
            plaid: {
              accessTokenEncrypted: c.accessTokenEncrypted,
              itemId: c.itemId,
              env: c.mode,
              institutionName: c.name,
              accountName: c.account,
              accountMask: c.last4,
              connectedAt: new Date(c.connectedAt),
            },
          },
        },
      );
    },
    async get(userId) {
      await connectToDatabase();
      const doc = await User.findById(userId).select("+plaid.accessTokenEncrypted plaid").lean();
      const p = doc?.plaid;
      if (!p?.accessTokenEncrypted || !p.itemId) return null;
      return {
        accessTokenEncrypted: p.accessTokenEncrypted,
        itemId: p.itemId,
        name: p.institutionName ?? "Connected bank",
        account: p.accountName ?? "Account",
        last4: p.accountMask ?? "0000",
        mode: p.env === "production" ? "production" : "sandbox",
        connectedAt: (p.connectedAt ?? new Date()).toISOString(),
      };
    },
    async clear(userId) {
      await connectToDatabase();
      await User.updateOne({ _id: new Types.ObjectId(userId) }, { $unset: { plaid: 1 } });
    },
  };
}

// ---------- Validation of browser input ----------

const clean = (v: unknown, max: number, fallback: string) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) || fallback : fallback;

export type ExchangeRequest = { publicToken: string; name: string; account: string; last4: string };

/** Validates the exchange request. Bank/account names are display-only and are cleaned. */
export function parseExchangeRequest(body: unknown): ExchangeRequest | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (!isValidPublicToken(b.public_token)) return null;
  const institution = (b.institution ?? {}) as Record<string, unknown>;
  const account = (b.account ?? {}) as Record<string, unknown>;
  const mask = typeof account.mask === "string" && /^\d{2,4}$/.test(account.mask) ? account.mask : "0000";
  return {
    publicToken: b.public_token,
    name: clean(institution.name, 80, "Connected bank"),
    account: clean(account.name, 60, "Account"),
    last4: mask.padStart(4, "0").slice(-4),
  };
}

// ---------- Operations ----------

export type ConnectDeps = { plaid: PlaidApi; env: PlaidEnvName; store?: BankConnectionStore; now?: Date };

/** Exchanges the public token, encrypts the access token and saves the connection for this user. */
export async function connectBank(userId: string, req: ExchangeRequest, deps: ConnectDeps): Promise<PublicBankConnection> {
  assertUserId(userId);
  const { accessToken, itemId } = await exchangePublicToken(deps.plaid, req.publicToken);
  const connection: StoredBankConnection = {
    accessTokenEncrypted: encryptSecret(accessToken),
    itemId,
    name: req.name,
    account: req.account,
    last4: req.last4,
    mode: deps.env,
    connectedAt: (deps.now ?? new Date()).toISOString(),
  };
  const store = deps.store ?? (await defaultStore());
  await store.save(userId, connection);
  return toPublic(connection);
}

export async function getBankConnection(userId: string, store?: BankConnectionStore): Promise<PublicBankConnection | null> {
  assertUserId(userId);
  const db = store ?? (await defaultStore());
  const c = await db.get(userId);
  return c ? toPublic(c) : null;
}

/** Revokes the access token at Plaid (best effort) and removes the connection. */
export async function disconnectBankForUser(
  userId: string,
  deps: { plaid: PlaidApi | null; store?: BankConnectionStore },
): Promise<void> {
  assertUserId(userId);
  const db = deps.store ?? (await defaultStore());
  const c = await db.get(userId);
  if (c && deps.plaid) {
    try {
      await removeItem(deps.plaid, decryptSecret(c.accessTokenEncrypted));
    } catch (err) {
      console.error("[plaid] Could not revoke item:", err instanceof Error ? err.message : err);
    }
  }
  await db.clear(userId);
}

function toPublic({ name, account, last4, mode, connectedAt }: StoredBankConnection): PublicBankConnection {
  return { name, account, last4, mode, connectedAt };
}
