// SERVER-ONLY. Plaid (Sandbox) helpers. Plaid keys are read from the server environment
// and never sent to the browser.
//
// This is deliberately locked to Plaid's Sandbox: it can't touch real bank accounts.
// Going live later means production keys, a token exchange route, and encrypted storage
// of Plaid access tokens.

export const PLAID_SANDBOX_URL = "https://sandbox.plaid.com";

export function plaidCredentials(env: NodeJS.ProcessEnv = process.env): { clientId: string; secret: string } | null {
  const clientId = env.PLAID_CLIENT_ID?.trim();
  const secret = env.PLAID_SECRET?.trim();
  return clientId && secret ? { clientId, secret } : null;
}

export class PlaidError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Creates a Plaid Link token (Sandbox) for one CalmOwe user. */
export async function createSandboxLinkToken(
  userId: string,
  creds: { clientId: string; secret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(`${PLAID_SANDBOX_URL}/link/token/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: creds.clientId,
      secret: creds.secret,
      client_name: "CalmOwe",
      user: { client_user_id: userId },
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data: { link_token?: unknown; error_code?: unknown } = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.link_token !== "string") {
    throw new PlaidError(`Plaid link token failed: ${res.status} ${String(data.error_code ?? "")}`.trim(), res.status);
  }
  return data.link_token;
}
