"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Check } from "lucide-react";
import { Field, FormError, inputClass, PasswordInput, SubmitButton } from "@/components/auth/AuthFields";
import { safeCallbackUrl } from "@/lib/auth/redirect";
import type { SignupField } from "@/lib/auth/validation";
import { signUp } from "./actions";

type Errors = Partial<Record<SignupField, string>>;

export function SignupForm() {
  const router = useRouter();
  const callbackUrl = safeCallbackUrl(useSearchParams().get("callbackUrl"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  const longEnough = password.length >= 8;
  const hasLetterAndNumber = /[A-Za-z]/.test(password) && /\d/.test(password);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setErrors({});
    setPending(true);
    try {
      // Validation, duplicate check and bcrypt hashing all happen on the server.
      const result = await signUp({ name, email, password });
      if (!result.ok) {
        setErrors(result.errors);
        setPending(false);
        return;
      }
      const res = await signIn("credentials", { email: email.trim(), password, redirect: false, callbackUrl });
      if (res?.ok && !res.error) {
        router.replace(callbackUrl);
        router.refresh();
        return;
      }
      // Account exists but auto-login failed; send them to log in.
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    } catch {
      setErrors({ form: "Couldn't reach CalmOwe. Check your connection and try again." });
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={errors.form} />
      <Field id="name" label="Full name" error={errors.name}>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          className={inputClass(!!errors.name)}
        />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
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
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={inputClass(!!errors.email)}
        />
      </Field>
      <Field id="password" label="Password" error={errors.password}>
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" invalid={!!errors.password} />
      </Field>
      {!errors.password && (
        <ul className="space-y-1 text-xs" aria-label="Password requirements">
          {[
            [longEnough, "At least 8 characters"],
            [hasLetterAndNumber, "At least one letter and one number"],
          ].map(([met, label]) => (
            <li key={label as string} className={`flex items-center gap-1.5 ${met ? "text-emerald-400" : "text-zinc-500"}`}>
              <Check className="size-3.5" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      )}
      <SubmitButton pending={pending} pendingLabel="Creating account...">
        Create account
      </SubmitButton>
      <p className="text-center text-xs leading-relaxed text-zinc-500">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="text-zinc-300 hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-zinc-300 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="pt-1 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-white hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
