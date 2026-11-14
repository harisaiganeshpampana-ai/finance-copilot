// SERVER-ONLY. Read the logged-in user in server code (pages, route handlers, server actions).

import { unstable_rethrow } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export type CurrentUser = { id: string; name?: string | null; email?: string | null };

/** The logged-in user (with their database id), or null if not logged in. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;
    if (!user?.id) return null;
    return { id: user.id, name: user.name, email: user.email };
  } catch (err) {
    // Let Next.js's own control-flow signals through (e.g. "this needs request-time
    // rendering" during prerendering); swallowing them could bake a logged-out state into
    // the static page shell.
    unstable_rethrow(err);
    // Real failures, e.g. NEXTAUTH_SECRET missing on the server: treat as logged out (fail closed).
    console.error("[auth] Could not read session:", err instanceof Error ? err.message : err);
    return null;
  }
}
