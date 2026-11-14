"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EyeOff, KeyRound, Landmark, Loader2, Lock, ShieldCheck, Unlink, X, type LucideIcon } from "lucide-react";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { type BankConnection, DEMO_BANK } from "./bank-store";

const safetyPoints: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Lock, title: "Bank-grade encryption", body: "Your connection is encrypted in transit and at rest." },
  { icon: EyeOff, title: "Read-only access", body: "CalmOwe can view balances and transactions. It can never move money." },
  { icon: KeyRound, title: "Your login stays private", body: "You sign in with your bank through Plaid. CalmOwe never sees your password." },
  { icon: Unlink, title: "Disconnect anytime", body: "Revoke access with one click whenever you want." },
];

/** How long the simulated connection takes when Plaid isn't configured. */
export const SIMULATED_CONNECT_MS = 1200;

/** The display details Plaid Link gives us on success (sent to the server with the public token). */
export function exchangeBody(publicToken: string, metadata: Pick<PlaidLinkOnSuccessMetadata, "institution" | "accounts">) {
  const account = metadata.accounts?.[0];
  return {
    public_token: publicToken,
    institution: { name: metadata.institution?.name ?? null },
    account: { name: account?.name ?? null, mask: account?.mask ?? null },
  };
}

type Stage =
  | { name: "intro"; notice?: string }
  | { name: "starting" }
  | { name: "plaid"; token: string }
  | { name: "exchanging" }
  | { name: "simulating" }
  | { name: "error"; message: string };

/** Opens the Plaid Link UI as soon as the SDK is ready. */
function PlaidLinkLauncher({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (publicToken: string | null, metadata: PlaidLinkOnSuccessMetadata) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return (
    <p className="flex items-center justify-center gap-2 py-2.5 text-sm text-zinc-400" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Continue in the Plaid window...
    </p>
  );
}

export function ConnectBankModal({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  /** Called once the bank is connected (the parent closes the modal and shows a toast). */
  onConnected: (connection: BankConnection) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [stage, setStage] = useState<Stage>({ name: "intro" });

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

  const fail = (message: string) => setStage({ name: "error", message });

  const start = async () => {
    setStage({ name: "starting" });
    try {
      const res = await fetch("/api/plaid/create_link_token", { method: "POST" });
      const data: { mode?: string; linkToken?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) return fail(data.error ?? "Couldn't start the bank connection. Please try again.");
      if (data.mode === "plaid" && data.linkToken) return setStage({ name: "plaid", token: data.linkToken });

      // Plaid isn't configured (e.g. local development): simulate a successful connection.
      setStage({ name: "simulating" });
      await new Promise((r) => setTimeout(r, SIMULATED_CONNECT_MS));
      onConnected(DEMO_BANK);
    } catch {
      fail("Couldn't reach CalmOwe. Check your connection and try again.");
    }
  };

  // Plaid Link succeeded: hand the public token to our server, which exchanges and stores it.
  const finish = async (publicToken: string | null, metadata: PlaidLinkOnSuccessMetadata) => {
    if (!publicToken) return fail("Your bank didn't finish connecting. Please try again.");
    setStage({ name: "exchanging" });
    try {
      const res = await fetch("/api/plaid/exchange_public_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exchangeBody(publicToken, metadata)),
      });
      const data: { ok?: boolean; bank?: BankConnection; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.bank) return fail(data.error ?? "Couldn't finish connecting your bank. Please try again.");
      onConnected(data.bank);
    } catch {
      fail("Couldn't reach CalmOwe. Check your connection and try again.");
    }
  };

  const busy = stage.name !== "intro" && stage.name !== "error";
  const busyLabel =
    stage.name === "starting"
      ? "Opening secure connection..."
      : stage.name === "exchanging"
        ? "Securing your connection..."
        : stage.name === "simulating"
          ? "Connecting to your bank..."
          : "Connect Bank";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onClose} aria-hidden="true" />
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
            Securely connect your bank
          </h2>
          <p id="connect-bank-desc" className="mx-auto mt-1.5 max-w-xs text-sm text-zinc-400">
            CalmOwe uses bank-grade encryption and read-only access.
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
          {stage.name === "intro" && stage.notice && <p className="pb-1 text-center text-xs text-zinc-400">{stage.notice}</p>}
          {stage.name === "error" && (
            <p role="alert" className="pb-1 text-center text-xs text-rose-400">
              {stage.message}
            </p>
          )}

          {stage.name === "plaid" ? (
            <PlaidLinkLauncher
              token={stage.token}
              onSuccess={(publicToken, metadata) => void finish(publicToken, metadata)}
              onExit={() => setStage({ name: "intro", notice: "Connection cancelled. You can try again anytime." })}
            />
          ) : (
            <button
              ref={primaryRef}
              type="button"
              onClick={() => void start()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-70"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
              {busyLabel}
            </button>
          )}
          <button type="button" onClick={onClose} className="w-full rounded-md px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-white">
            Cancel
          </button>
          <p className="pt-1 text-center text-[11px] text-zinc-600">Powered by Plaid. Sandbox uses test banks only.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
