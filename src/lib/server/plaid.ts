// SERVER-ONLY. Plaid helpers using the official Plaid Node SDK. Plaid keys are read from the
// server environment and never sent to the browser.

import { Plaid, PlaidClient, PlaidEnvironment } from "plaid";

export type PlaidEnvName = "sandbox" | "production";

export type PlaidConfig = { clientId: string; secret: string; env: PlaidEnvName };

/** Plaid settings from the server environment, or null if keys aren't configured. */
export function plaidConfig(env: NodeJS.ProcessEnv = process.env): PlaidConfig | null {
  const clientId = env.PLAID_CLIENT_ID?.trim();
  const secret = env.PLAID_SECRET?.trim();
  if (!clientId || !secret) return null;
  // Anything other than an explicit "production" uses Sandbox (safe default).
  const plaidEnv: PlaidEnvName = env.PLAID_ENV?.trim().toLowerCase() === "production" ? "production" : "sandbox";
  return { clientId, secret, env: plaidEnv };
}

/** The subset of the Plaid SDK CalmOwe uses (lets tests pass a fake). */
export type PlaidApi = {
  link: { createToken(req: Plaid.LinkTokenCreateRequest): PromiseLike<{ link_token: string }> };
  item: {
    exchangePublicToken(req: Plaid.ItemPublicTokenExchangeRequest): PromiseLike<{ access_token: string; item_id: string }>;
    remove(req: Plaid.ItemRemoveRequest): PromiseLike<unknown>;
  };
};

export function createPlaidClient(config: PlaidConfig): PlaidApi {
  return new PlaidClient({
    environment: config.env === "production" ? PlaidEnvironment.Production : PlaidEnvironment.Sandbox,
    clientId: config.clientId,
    secret: config.secret,
    timeoutInSeconds: 20,
  });
}

/** Creates a Plaid Link token for one CalmOwe user. */
export async function createLinkToken(client: PlaidApi, userId: string): Promise<string> {
  const res = await client.link.createToken({
    client_name: "CalmOwe",
    user: { client_user_id: userId },
    products: ["transactions"],
    country_codes: ["US"],
    language: "en",
  });
  if (typeof res?.link_token !== "string") throw new Error("Plaid returned no link token");
  return res.link_token;
}

/** Exchanges the short-lived public token from Plaid Link for a long-lived access token. */
export async function exchangePublicToken(client: PlaidApi, publicToken: string): Promise<{ accessToken: string; itemId: string }> {
  const res = await client.item.exchangePublicToken({ public_token: publicToken });
  if (typeof res?.access_token !== "string" || typeof res?.item_id !== "string") {
    throw new Error("Plaid returned no access token");
  }
  return { accessToken: res.access_token, itemId: res.item_id };
}

/** Revokes an access token at Plaid (used on disconnect). */
export async function removeItem(client: PlaidApi, accessToken: string): Promise<void> {
  await client.item.remove({ access_token: accessToken });
}

/** Public tokens from Plaid Link look like "public-sandbox-<uuid>" / "public-production-<uuid>". */
export function isValidPublicToken(value: unknown): value is string {
  return typeof value === "string" && value.length <= 200 && /^public-(sandbox|production|development)-[A-Za-z0-9-]+$/.test(value);
}
