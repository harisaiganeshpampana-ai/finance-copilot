import { getCurrentUser } from "@/lib/auth/session";
import { connectBank, parseExchangeRequest } from "@/lib/server/bank-connection";
import { createPlaidClient, plaidConfig } from "@/lib/server/plaid";

// POST /api/plaid/exchange_public_token — after Plaid Link succeeds, the browser sends the
// short-lived public_token. The server exchanges it for an access_token, encrypts it and saves
// it on the logged-in user's MongoDB document. The access token is never returned.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please log in to connect a bank." }, { status: 401 });

  const config = plaidConfig();
  if (!config) return Response.json({ error: "Bank connections aren't configured yet." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const req = parseExchangeRequest(body);
  if (!req) return Response.json({ error: "Invalid request." }, { status: 400 });

  try {
    const bank = await connectBank(user.id, req, { plaid: createPlaidClient(config), env: config.env });
    return Response.json({ ok: true, bank });
  } catch (err) {
    console.error("[plaid] exchange_public_token failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Couldn't finish connecting your bank. Please try again." }, { status: 502 });
  }
}
