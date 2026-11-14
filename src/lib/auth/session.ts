// SERVER-ONLY. Read the logged-in user in server code (route handlers, server actions).

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export async function getCurrentUser(): Promise<{ name?: string | null; email?: string | null } | null> {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}
