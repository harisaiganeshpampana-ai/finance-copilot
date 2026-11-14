import type { Metadata } from "next";
import { Suspense } from "react";
import { isGoogleAuthEnabled } from "@/lib/auth/options";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a free CalmOwe account.",
};

export default function SignupPage() {
  const googleEnabled = isGoogleAuthEnabled();
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-7 shadow-2xl shadow-black/50 backdrop-blur sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-white">Create your account</h1>
      <p className="mt-1.5 text-sm text-zinc-400">Start free. Take control of your cash flow in minutes.</p>
      <div className="mt-7">
        <Suspense fallback={<div className="h-80" aria-hidden="true" />}>
          <SignupForm googleEnabled={googleEnabled} />
        </Suspense>
      </div>
    </div>
  );
}
