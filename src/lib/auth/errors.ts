// Friendly messages for NextAuth's ?error= codes (e.g. after a Google sign-in redirect).
// Safe for the browser: no secrets, just text.

export function authErrorMessage(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  switch (code) {
    case "AccessDenied":
      return "Google sign-in was cancelled, or your Google email isn't verified.";
    case "OAuthAccountNotLinked":
      return "This email is already linked to a different sign-in method.";
    case "OAuthSignin":
    case "OAuthCallback":
    case "Callback":
      return "Couldn't sign in with Google. Please try again.";
    case "CredentialsSignin":
      return "Incorrect email or password.";
    case "SessionRequired":
      return "Please log in to continue.";
    default:
      return "Couldn't sign you in. Please try again.";
  }
}
