import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { loginRedirectUrl } from "@/lib/auth/redirect";

// Runs before protected pages render. Visitors without a valid login session are
// redirected to /login, with a callbackUrl so they come back after logging in.
export async function proxy(request: NextRequest) {
  let token = null;
  try {
    token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  } catch (err) {
    // e.g. NEXTAUTH_SECRET missing on the server: fail closed (send to /login) instead of erroring.
    console.error("[proxy] Could not read session:", err instanceof Error ? err.message : err);
  }
  if (!token) return NextResponse.redirect(loginRedirectUrl(request.url));
  return NextResponse.next();
}

// Keep in sync with PROTECTED_PREFIXES in src/lib/auth/redirect.ts.
export const config = {
  matcher: ["/dashboard/:path*", "/copilot/:path*", "/settings/:path*"],
};
