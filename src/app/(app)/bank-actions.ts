"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { disconnectBankForUser, getBankConnection, type PublicBankConnection } from "@/lib/server/bank-connection";
import { createPlaidClient, plaidConfig } from "@/lib/server/plaid";

/** The logged-in user's connected bank (public details only, no tokens), or null. */
export async function getBankConnectionStatus(): Promise<PublicBankConnection | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    return await getBankConnection(user.id);
  } catch (err) {
    console.error("[plaid] Could not read connection:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Disconnects the logged-in user's bank: revokes the token at Plaid and deletes it. */
export async function disconnectBank(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  try {
    const config = plaidConfig();
    await disconnectBankForUser(user.id, { plaid: config ? createPlaidClient(config) : null });
    return { ok: true };
  } catch (err) {
    console.error("[plaid] Disconnect failed:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}
