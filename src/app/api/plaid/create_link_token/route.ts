import { getCurrentUser } from "@/lib/auth/session";
import { createLinkToken, createPlaidClient, plaidConfig } from "@/lib/server/plaid";

export type CreateLinkTokenResponse = { mode: "plaid"; linkToken: string; env: "sandbox" | "production" } | { mode: "demo" };

// POST /api/plaid/create_link_token — creates a Plaid Link token for the logged-in user,
// using PLAID_CLIENT_ID / PLAID_SECRET from the server environment.
// Without Plaid keys (e.g. local dev), returns { mode: "demo" } so the UI can simulate.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please log in to connect a bank." }, { status: 401 });

  const config = plaidConfig();
  if (!config) return Response.json({ mode: "demo" } satisfies CreateLinkTokenResponse);

  try {
    const linkToken = await createLinkToken(createPlaidClient(config), user.id);
    return Response.json({ mode: "plaid", linkToken, env: config.env } satisfies CreateLinkTokenResponse);
  } catch (err) {
    console.error("[plaid] create_link_token failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Couldn't start the bank connection. Please try again." }, { status: 502 });
  }
}
