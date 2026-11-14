"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const inputClass = (invalid: boolean) =>
  `block w-full rounded-lg border bg-zinc-900/70 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 transition-colors focus:outline-none focus:ring-2 ${
    invalid
      ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20"
      : "border-zinc-800 hover:border-zinc-700 focus:border-zinc-600 focus:ring-zinc-500/20"
  }`;

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-300">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  invalid: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name="password"
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        maxLength={128}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={`${inputClass(invalid)} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-zinc-500 hover:text-zinc-300"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

export function SubmitButton({ pending, children, pendingLabel }: { pending: boolean; children: React.ReactNode; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-70"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
      {message}
    </p>
  );
}
