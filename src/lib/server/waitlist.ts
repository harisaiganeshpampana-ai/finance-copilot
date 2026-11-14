// SERVER-ONLY. "Join Waitlist for Real Sync": one entry per user, email taken from the
// logged-in session (never from browser input). The store is injectable for tests.

import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";
import { assertUserId } from "@/lib/server/transactions";

export type WaitlistStore = {
  isOnWaitlist(userId: string): Promise<boolean>;
  /** Adds the user if they aren't on the list yet. `created` is false if already there. */
  add(entry: { userId: string; email: string }): Promise<{ created: boolean }>;
};

async function defaultStore(): Promise<WaitlistStore> {
  const [{ Types }, { connectToDatabase }, { WaitlistEntry }] = await Promise.all([
    import("mongoose"),
    import("@/lib/server/db"),
    import("@/models/WaitlistEntry"),
  ]);
  return {
    async isOnWaitlist(userId) {
      await connectToDatabase();
      return (await WaitlistEntry.exists({ userId: new Types.ObjectId(userId) })) !== null;
    },
    async add({ userId, email }) {
      await connectToDatabase();
      const result = await WaitlistEntry.updateOne(
        { userId: new Types.ObjectId(userId) },
        { $setOnInsert: { userId: new Types.ObjectId(userId), email, feature: "real-bank-sync" } },
        { upsert: true },
      );
      return { created: result.upsertedCount > 0 };
    },
  };
}

export type JoinWaitlistResult = { ok: true; alreadyJoined: boolean; email: string } | { ok: false; error: string };

export async function joinWaitlist(
  user: { id: string; email?: string | null },
  store?: WaitlistStore,
): Promise<JoinWaitlistResult> {
  assertUserId(user.id);
  const email = normalizeEmail(user.email);
  if (!isValidEmail(email)) return { ok: false, error: "Your account doesn't have a valid email address." };
  const db = store ?? (await defaultStore());
  const { created } = await db.add({ userId: user.id, email });
  return { ok: true, alreadyJoined: !created, email };
}

export async function isOnWaitlist(userId: string, store?: WaitlistStore): Promise<boolean> {
  assertUserId(userId);
  const db = store ?? (await defaultStore());
  return db.isOnWaitlist(userId);
}
