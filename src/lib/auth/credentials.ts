// SERVER-ONLY. Sign-up and log-in logic. Database access is injected (`deps`) so this
// can be tested without a real MongoDB; the defaults use the Mongoose User model.

import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/auth/password";
import { parseLoginCredentials, validateSignup, type SignupField } from "@/lib/auth/validation";
import { DatabaseNotConfiguredError } from "@/lib/server/db";

// passwordHash is null for accounts created with Google (they have no password).
export type StoredUser = { id: string; name: string; email: string; passwordHash: string | null };
export type PublicUser = { id: string; name: string; email: string };

export type UserStore = {
  findByEmail(email: string): Promise<StoredUser | null>;
  create(user: { name: string; email: string; passwordHash: string }): Promise<PublicUser>;
  /**
   * Find the account for a verified Google email, or create one. Never touches an existing
   * password. `created` is true when a new account was made.
   */
  upsertOAuthUser(user: {
    name: string;
    email: string;
    image?: string | null;
    provider: "google";
  }): Promise<PublicUser & { created: boolean }>;
};

/** Runs after a brand-new account is created (gives the user sample data). Must not throw. */
export type OnUserCreated = (userId: string) => Promise<void>;

async function defaultStore(): Promise<UserStore> {
  const { mongoUserStore } = await import("@/lib/auth/user-store");
  return mongoUserStore;
}

const defaultOnUserCreated: OnUserCreated = async (userId) => {
  const { seedSampleDataSafely } = await import("@/lib/server/transactions");
  await seedSampleDataSafely(userId);
};

// ---------- Log-in ----------

const LOGIN_WINDOW_MS = 15 * 60_000;
export const MAX_LOGIN_ATTEMPTS = 10;
const loginAttempts = new Map<string, number[]>();

/** Best-effort brute-force protection per email (per server instance). */
export function isLoginRateLimited(email: string, now = Date.now()): boolean {
  const recent = (loginAttempts.get(email) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  recent.push(now);
  loginAttempts.set(email, recent);
  return recent.length > MAX_LOGIN_ATTEMPTS;
}

export function resetLoginAttemptsForTests(): void {
  loginAttempts.clear();
}

/** Returns the user for valid credentials, otherwise null. Used by NextAuth's Credentials provider. */
export async function authorizeCredentials(raw: unknown, store?: UserStore): Promise<PublicUser | null> {
  const creds = parseLoginCredentials(raw);
  if (!creds) return null;
  if (isLoginRateLimited(creds.email)) return null;

  const users = store ?? (await defaultStore());
  const user = await users.findByEmail(creds.email);
  // No account, or a Google-only account without a password: reject (same timing either way).
  if (!user || !user.passwordHash) {
    await burnPasswordCheck(creds.password);
    return null;
  }
  if (!(await verifyPassword(creds.password, user.passwordHash))) return null;
  return { id: user.id, name: user.name, email: user.email };
}

// ---------- Sign-up ----------

export type RegisterResult =
  | { ok: true; user: PublicUser }
  | { ok: false; errors: Partial<Record<SignupField, string>> };

export async function registerUser(
  input: unknown,
  store?: UserStore,
  onUserCreated: OnUserCreated = defaultOnUserCreated,
): Promise<RegisterResult> {
  const parsed = validateSignup(input);
  if (!parsed.ok) return parsed;
  const { name, email, password } = parsed.data;

  try {
    const users = store ?? (await defaultStore());
    const existing = await users.findByEmail(email);
    if (existing) {
      return {
        ok: false,
        errors: {
          email: existing.passwordHash
            ? "An account with this email already exists. Log in instead."
            : "This email is registered with Google. Use Continue with Google.",
        },
      };
    }
    const user = await users.create({ name, email, passwordHash: await hashPassword(password) });
    await onUserCreated(user.id);
    return { ok: true, user };
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) {
      console.error("[auth] Sign-up unavailable: MONGODB_URI is not set.");
      return { ok: false, errors: { form: "Sign-up isn't available yet. Please try again later." } };
    }
    // Duplicate key race (two sign-ups with the same email at once).
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return { ok: false, errors: { email: "An account with this email already exists. Log in instead." } };
    }
    console.error("[auth] Sign-up failed:", err instanceof Error ? err.message : err);
    return { ok: false, errors: { form: "Something went wrong creating your account. Please try again." } };
  }
}

// ---------- Google sign-in ----------

export type OAuthProfile = { email?: string | null; email_verified?: boolean | null; name?: string | null; picture?: string | null };

/**
 * Called when someone signs in with Google. Only verified Google emails are accepted
 * (so nobody can take over an account by claiming an email they don't own). The user
 * is found or created in MongoDB; an existing email/password account is linked by email.
 * Returns the CalmOwe user, or null to deny sign-in.
 */
export async function handleGoogleSignIn(
  profile: OAuthProfile | undefined,
  store?: UserStore,
  onUserCreated: OnUserCreated = defaultOnUserCreated,
): Promise<PublicUser | null> {
  const email = typeof profile?.email === "string" ? profile.email.trim().toLowerCase() : "";
  if (!email || profile?.email_verified !== true) return null;
  const name = (typeof profile?.name === "string" && profile.name.trim().slice(0, 100)) || email.split("@")[0];
  const image = typeof profile?.picture === "string" ? profile.picture.slice(0, 2048) : null;

  try {
    const users = store ?? (await defaultStore());
    const { created, ...user } = await users.upsertOAuthUser({ name, email, image, provider: "google" });
    if (created) await onUserCreated(user.id);
    return user;
  } catch (err) {
    console.error("[auth] Google sign-in could not save user:", err instanceof Error ? err.message : err);
    return null;
  }
}
