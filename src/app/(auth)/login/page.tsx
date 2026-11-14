import type { Metadata } from "next";
import { Suspense } from "react";
import { isGoogleAuthEnabled } from "@/lib/auth/options";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to CalmOwe.",
};

export default function LoginPage() {
  // Checked on the server; the browser only learns whether to show the Google button.
  const googleEnabled = isGoogleAuthEnabled();
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-7 shadow-2xl shadow-black/50 backdrop-blur sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
      <p className="mt-1.5 text-sm text-zinc-400">Log in to see where your money stands.</p>
      <div className="mt-7">
        {/* The form reads ?callbackUrl and ?error from the URL, which needs a Suspense boundary. */}
        <Suspense fallback={<div className="h-64" aria-hidden="true" />}>
          <LoginForm googleEnabled={googleEnabled} />
        </Suspense>
      </div>
    </div>
  );
}
