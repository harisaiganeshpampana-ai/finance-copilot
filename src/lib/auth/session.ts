// SERVER-ONLY. Read the logged-in user in server code (route handlers, server actions).

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export async function getCurrentUser(): Promise<{ name?: string | null; email?: string | null } | null> {
  try {
    const session = await getServerSession(authOptions);
    return session?.user ?? null;
  } catch (err) {
    // e.g. NEXTAUTH_SECRET missing on the server: treat as logged out (fail closed).
    console.error("[auth] Could not read session:", err instanceof Error ? err.message : err);
    return null;
  }
}
