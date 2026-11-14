"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { joinWaitlist, type JoinWaitlistResult } from "@/lib/server/waitlist";

/**
 * Adds the logged-in user to the "real bank sync" waitlist. Takes no browser input:
 * the user and their email come from the server-side session.
 */
export async function joinRealSyncWaitlist(): Promise<JoinWaitlistResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in again." };
  try {
    return await joinWaitlist(user);
  } catch (err) {
    console.error("[waitlist] Join failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Couldn't join the waitlist. Please try again." };
  }
}
