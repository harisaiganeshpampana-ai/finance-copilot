import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeCredentials,
  handleGoogleSignIn,
  registerUser,
  type StoredUser,
  type UserStore,
} from "@/lib/auth/credentials";
import { authErrorMessage } from "@/lib/auth/errors";
import { authOptions, buildProviders, googleCredentials, isGoogleAuthEnabled } from "@/lib/auth/options";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

function memoryStore(initial: StoredUser[] = []) {
  const users = [...initial];
  const store: UserStore = {
    findByEmail: vi.fn(async (email: string) => users.find((u) => u.email === email) ?? null),
    create: vi.fn(async ({ name, email, passwordHash }) => {
      const user = { id: `u${users.length + 1}`, name, email, passwordHash };
      users.push(user);
      return { id: user.id, name, email };
    }),
    upsertOAuthUser: vi.fn(async ({ name, email }) => {
      const existing = users.find((u) => u.email === email);
      if (existing) return { id: existing.id, name: existing.name, email: existing.email };
      const user = { id: `u${users.length + 1}`, name, email, passwordHash: null };
      users.push(user);
      return { id: user.id, name, email };
    }),
  };
  return { store, users };
}

const env = (vars: Record<string, string>) => ({ ...vars }) as NodeJS.ProcessEnv;
const googleProfile = { email: "Hari@Gmail.com", email_verified: true, name: "Hari Sai Ganesh", picture: "https://lh3.example/p.jpg" };

afterEach(() => vi.restoreAllMocks());

describe("Google provider configuration", () => {
  it("is enabled only when both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set", () => {
    expect(googleCredentials(env({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }))).toEqual({
      clientId: "id",
      clientSecret: "secret",
    });
    expect(isGoogleAuthEnabled(env({ GOOGLE_CLIENT_ID: "id" }))).toBe(false);
    expect(isGoogleAuthEnabled(env({ GOOGLE_CLIENT_SECRET: "secret" }))).toBe(false);
    expect(isGoogleAuthEnabled(env({ GOOGLE_CLIENT_ID: " ", GOOGLE_CLIENT_SECRET: " " }))).toBe(false);
  });

  it("adds GoogleProvider next to email/password when configured", () => {
    expect(buildProviders(env({})).map((p) => p.id)).toEqual(["credentials"]);
    expect(buildProviders(env({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })).map((p) => p.id)).toEqual([
      "credentials",
      "google",
    ]);
  });

  it("sends sign-in errors back to /login", () => {
    expect(authOptions.pages).toEqual({ signIn: "/login", error: "/login" });
  });
});

describe("handleGoogleSignIn", () => {
  it("creates a CalmOwe user (no password) on first Google sign-in", async () => {
    const { store, users } = memoryStore();
    const user = await handleGoogleSignIn(googleProfile, store);
    expect(user).toEqual({ id: "u1", name: "Hari Sai Ganesh", email: "hari@gmail.com" });
    expect(users[0].passwordHash).toBeNull();
    expect(store.upsertOAuthUser).toHaveBeenCalledWith({
      name: "Hari Sai Ganesh",
      email: "hari@gmail.com",
      image: "https://lh3.example/p.jpg",
      provider: "google",
    });
  });

  it("links to an existing email/password account and keeps its password", async () => {
    const hash = await hashPassword("calmowe123");
    const { store, users } = memoryStore([{ id: "u1", name: "Hari", email: "hari@gmail.com", passwordHash: hash }]);
    const user = await handleGoogleSignIn(googleProfile, store);
    expect(user?.id).toBe("u1");
    expect(users).toHaveLength(1);
    expect(await verifyPassword("calmowe123", users[0].passwordHash!)).toBe(true);
  });

  it("rejects unverified or missing Google emails (prevents account takeover)", async () => {
    const { store } = memoryStore();
    expect(await handleGoogleSignIn({ ...googleProfile, email_verified: false }, store)).toBeNull();
    expect(await handleGoogleSignIn({ ...googleProfile, email_verified: undefined }, store)).toBeNull();
    expect(await handleGoogleSignIn({ ...googleProfile, email: "" }, store)).toBeNull();
    expect(await handleGoogleSignIn(undefined, store)).toBeNull();
    expect(store.upsertOAuthUser).not.toHaveBeenCalled();
  });

  it("falls back to the email name if Google gives no name, and denies sign-in if saving fails", async () => {
    const { store } = memoryStore();
    expect((await handleGoogleSignIn({ email: "solo@gmail.com", email_verified: true }, store))?.name).toBe("solo");

    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: UserStore = { ...store, upsertOAuthUser: async () => Promise.reject(new Error("db down")) };
    expect(await handleGoogleSignIn(googleProfile, broken)).toBeNull();
  });
});

describe("Google-only accounts and the email/password form", () => {
  const googleOnly = (): StoredUser => ({ id: "u1", name: "Hari", email: "hari@gmail.com", passwordHash: null });

  it("can't be logged into with a password", async () => {
    const { store } = memoryStore([googleOnly()]);
    expect(await authorizeCredentials({ email: "hari@gmail.com", password: "anything1" }, store)).toBeNull();
  });

  it("sign-up with that email points the user to Continue with Google", async () => {
    const { store } = memoryStore([googleOnly()]);
    const result = await registerUser({ name: "Hari", email: "hari@gmail.com", password: "calmowe123" }, store);
    expect(result.ok === false && result.errors.email).toBe("This email is registered with Google. Use Continue with Google.");
  });
});

describe("NextAuth callbacks", () => {
  type SignInArgs = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>["signIn"]>>[0];
  const signIn = (args: Partial<SignInArgs>) => authOptions.callbacks!.signIn!(args as SignInArgs);

  it("lets credential sign-ins through (already checked in authorize)", async () => {
    expect(await signIn({ user: { id: "u1" }, account: { provider: "credentials", type: "credentials", providerAccountId: "u1" } })).toBe(true);
  });

  it("denies Google sign-in when the Google email isn't verified", async () => {
    const result = await signIn({
      user: { id: "g1" },
      account: { provider: "google", type: "oauth", providerAccountId: "g1" },
      profile: { email: "x@gmail.com", email_verified: false } as SignInArgs["profile"],
    });
    expect(result).toBe(false);
  });

  it("puts the CalmOwe user id and name into the session token", () => {
    type JwtArgs = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>["jwt"]>>[0];
    const token = authOptions.callbacks!.jwt!({ token: {}, user: { id: "u42", name: "Hari" } } as JwtArgs);
    expect(token).toEqual({ sub: "u42", name: "Hari" });
  });
});

describe("authErrorMessage", () => {
  it("turns NextAuth error codes into friendly text", () => {
    expect(authErrorMessage(null)).toBeUndefined();
    expect(authErrorMessage("AccessDenied")).toMatch(/cancelled|isn't verified/);
    expect(authErrorMessage("OAuthCallback")).toBe("Couldn't sign in with Google. Please try again.");
    expect(authErrorMessage("SomethingNew")).toBe("Couldn't sign you in. Please try again.");
  });
});
