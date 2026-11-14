import { getCurrentUser } from "@/lib/auth/session";
import { createSandboxLinkToken, plaidCredentials } from "@/lib/server/plaid";

export type LinkTokenResponse = { mode: "sandbox"; linkToken: string } | { mode: "demo" };

// POST /api/plaid/link-token — starts the Connect Bank flow for the logged-in user.
// With Plaid Sandbox keys configured, returns a Link token so the real Plaid Link UI opens.
// Without keys, returns { mode: "demo" } and the app simulates a successful connection.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please log in to connect a bank." }, { status: 401 });

  const creds = plaidCredentials();
  if (!creds) return Response.json({ mode: "demo" } satisfies LinkTokenResponse);

  try {
    const linkToken = await createSandboxLinkToken(user.id, creds);
    return Response.json({ mode: "sandbox", linkToken } satisfies LinkTokenResponse);
  } catch (err) {
    console.error("[plaid] Could not create link token:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Couldn't start the bank connection. Please try again." }, { status: 502 });
  }
}
