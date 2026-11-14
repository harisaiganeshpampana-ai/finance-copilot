"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import { disconnectBank, getBankConnectionStatus } from "@/app/(app)/bank-actions";
import { type ConnectionMode, useBankConnection } from "./bank-store";
import { ConnectBankModal } from "./ConnectBankModal";

const modeLabel = (mode: ConnectionMode) => (mode === "sandbox" ? "Sandbox" : mode === "demo" ? "Demo" : null);

/** Sidebar card: prominent "Connect Bank" button, or the connected bank with a Synced badge. */
export function BankConnectionCard() {
  const { bank, connect, disconnect } = useBankConnection();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // The user's real (Plaid) connection lives in MongoDB: sync it on load so it shows on
  // every device. Simulated "demo" connections are browser-only and left alone.
  useEffect(() => {
    let cancelled = false;
    getBankConnectionStatus()
      .then((server) => {
        if (cancelled) return;
        if (server) connect({ name: server.name, account: server.account, last4: server.last4, mode: server.mode });
        else if (bank && bank.mode !== "demo") disconnect();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = bank ? modeLabel(bank.mode) : null;

  return (
    <>
      {bank ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-200">
              <Landmark className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[13px] font-medium text-white">{bank.name}</p>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  Synced
                </span>
              </div>
              <p className="text-xs text-zinc-500 tabular-nums">
                {bank.account} &bull;&bull;&bull;&bull; {bank.last4}
                {label ? ` · ${label}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              const name = bank.name;
              if (bank.mode !== "demo") {
                const result = await disconnectBank();
                if (!result.ok) {
                  toast.error("Couldn't disconnect", { description: "Please try again." });
                  return;
                }
              }
              disconnect();
              toast("Bank disconnected", { description: `${name} is no longer linked.` });
            }}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
          >
            <Unlink className="size-3.5" aria-hidden="true" />
            Disconnect
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="text-xs text-zinc-400">Link an account to see your real balances and transactions.</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            <Plus className="size-4" aria-hidden="true" />
            Connect Bank
          </button>
        </div>
      )}
      {open && (
        <ConnectBankModal
          onClose={close}
          onConnected={(connection) => {
            connect(connection);
            close();
            const tag = modeLabel(connection.mode);
            toast.success("Bank connected successfully!", {
              description: `${connection.name} ${connection.account} •••• ${connection.last4}${tag ? ` (${tag})` : ""}`,
            });
          }}
        />
      )}
    </>
  );
}

/** Header pill: "Demo data" until a bank is connected, then "Live Data Connected" (with its mode). */
export function DataSourcePill() {
  const { bank } = useBankConnection();
  const label = bank ? modeLabel(bank.mode) : null;
  return bank ? (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 py-1 pl-2.5 pr-1 text-xs font-medium text-emerald-400 md:inline-flex"
      data-testid="data-source-pill"
    >
      <span className="relative flex size-1.5" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
      </span>
      <span data-testid="data-source-label" className={label ? "" : "pr-1.5"}>
        Live Data Connected
      </span>
      {label && <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] text-amber-300">{label}</span>}
    </span>
  ) : (
    <span
      className="hidden rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400 md:inline"
      data-testid="data-source-pill"
    >
      Demo data
    </span>
  );
}
