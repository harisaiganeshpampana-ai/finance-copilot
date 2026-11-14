// Where to send a user after logging in. Only same-site paths are allowed, so a crafted
// link like /login?callbackUrl=https://evil.example can't redirect users off CalmOwe.

export const DEFAULT_AFTER_LOGIN = "/dashboard";
export const PROTECTED_PREFIXES = ["/dashboard", "/copilot", "/settings"] as const;

export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return DEFAULT_AFTER_LOGIN;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_AFTER_LOGIN;
  if (value.startsWith("/login") || value.startsWith("/signup")) return DEFAULT_AFTER_LOGIN;
  return value;
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The /login URL (with a callback back to the page the user wanted) for a protected request. */
export function loginRedirectUrl(requestUrl: string): URL {
  const url = new URL(requestUrl);
  const login = new URL("/login", url.origin);
  login.searchParams.set("callbackUrl", `${url.pathname}${url.search}`);
  return login;
}
