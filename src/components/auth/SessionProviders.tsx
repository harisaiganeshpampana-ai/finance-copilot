"use client";

import { SessionProvider } from "next-auth/react";

/** Makes the login session available to client components (useSession). */
export function SessionProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
