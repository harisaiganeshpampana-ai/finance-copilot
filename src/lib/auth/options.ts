// SERVER-ONLY. NextAuth configuration: email + password (Credentials) and Google, JWT sessions.

import type { NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers/index";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { authorizeCredentials, handleGoogleSignIn, type OAuthProfile } from "@/lib/auth/credentials";

/** Google OAuth credentials from the server environment, or null if not configured. */
export function googleCredentials(env: NodeJS.ProcessEnv = process.env): { clientId: string; clientSecret: string } | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Whether to show "Continue with Google" (only when the server has Google credentials). */
export function isGoogleAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return googleCredentials(env) !== null;
}

export function buildProviders(env: NodeJS.ProcessEnv = process.env): Provider[] {
  const providers: Provider[] = [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (credentials) => authorizeCredentials(credentials),
    }),
  ];
  const google = googleCredentials(env);
  if (google) providers.push(GoogleProvider(google));
  return providers;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
  // Sign-in problems (e.g. a cancelled Google sign-in) come back to /login?error=...
  pages: { signIn: "/login", error: "/login" },
  providers: buildProviders(),
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true; // credentials were checked in authorize()
      const saved = await handleGoogleSignIn(profile as OAuthProfile | undefined);
      if (!saved) return false;
      // Use the CalmOwe (MongoDB) user id and name for the session.
      user.id = saved.id;
      user.name = saved.name;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        if (user.name) token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      // Expose the user id (from the signed token) to server code.
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};
