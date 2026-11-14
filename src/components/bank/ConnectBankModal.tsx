"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { EyeOff, KeyRound, Landmark, Lock, ShieldCheck, Unlink, X, type LucideIcon } from "lucide-react";

const safetyPoints: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Lock, title: "Bank-grade encryption", body: "Your data is encrypted in transit and at rest." },
  { icon: EyeOff, title: "Read-only access", body: "CalmOwe can view balances and transactions. It can never move money." },
  { icon: KeyRound, title: "Your login stays private", body: "You sign in with your bank directly. CalmOwe never sees your password." },
  { icon: Unlink, title: "Disconnect anytime", body: "Revoke access with one click whenever you want." },
];

export function ConnectBankModal({ onClose, onContinue }: { onClose: () => void; onContinue: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden"; // lock background scroll

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      // Keep keyboard focus inside the dialog.
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button, [href], input, [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-bank-title"
        aria-describedby="connect-bank-desc"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <div className="border-b border-zinc-800/80 bg-gradient-to-b from-zinc-900/80 to-zinc-950 px-6 pb-6 pt-8 text-center">
          <div className="mx-auto flex w-fit items-center gap-2">
            <span className="grid size-11 place-items-center rounded-xl border border-zinc-700 bg-zinc-900 text-white">
              <Landmark className="size-5" aria-hidden="true" />
            </span>
            <span className="h-px w-6 bg-gradient-to-r from-zinc-700 to-emerald-500/60" aria-hidden="true" />
            <span className="grid size-11 place-items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
          </div>
          <h2 id="connect-bank-title" className="mt-5 text-lg font-semibold tracking-tight text-white">
            Connect your bank securely
          </h2>
          <p id="connect-bank-desc" className="mx-auto mt-1.5 max-w-xs text-sm text-zinc-400">
            Link your account to see real balances and transactions in CalmOwe.
          </p>
        </div>

        <ul className="space-y-4 px-6 py-6">
          {safetyPoints.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="text-xs leading-relaxed text-zinc-500">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-2 border-t border-zinc-800/80 px-6 py-5">
          <button
            ref={primaryRef}
            type="button"
            onClick={onContinue}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            <Lock className="size-4" aria-hidden="true" />
            Continue to Secure Login
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Cancel
          </button>
          <p className="pt-1 text-center text-[11px] text-zinc-600">
            Demo: no real bank connection is made yet.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
