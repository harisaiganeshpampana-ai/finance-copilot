"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Field, FormError, inputClass, PasswordInput, SubmitButton } from "@/components/auth/AuthFields";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { authErrorMessage } from "@/lib/auth/errors";
import { safeCallbackUrl } from "@/lib/auth/redirect";

export function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = safeCallbackUrl(params.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Errors from a Google sign-in redirect arrive as ?error=...
  const [error, setError] = useState<string | undefined>(() => authErrorMessage(params.get("error")));
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(undefined);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setPending(true);
    try {
      // Credentials are verified on the server (NextAuth Credentials provider).
      const res = await signIn("credentials", { email: email.trim(), password, redirect: false, callbackUrl });
      if (res?.ok && !res.error) {
        router.replace(callbackUrl);
        router.refresh();
        return;
      }
      setError("Incorrect email or password.");
    } catch {
      setError("Couldn't reach CalmOwe. Check your connection and try again.");
    }
    setPending(false);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={error} />
      {googleEnabled && (
        <>
          <GoogleButton callbackUrl={callbackUrl} />
          <OrDivider />
        </>
      )}
      <Field id="email" label="Email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputClass(false)}
        />
      </Field>
      <Field id="password" label="Password">
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" invalid={false} />
      </Field>
      <SubmitButton pending={pending} pendingLabel="Logging in...">
        Log in
      </SubmitButton>
      <p className="pt-2 text-center text-sm text-zinc-500">
        New to CalmOwe?{" "}
        <Link
          href={callbackUrl === "/dashboard" ? "/signup" : `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-white hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
