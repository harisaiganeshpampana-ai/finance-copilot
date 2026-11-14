"use client";

import { useState, useTransition } from "react";
import { BellRing, CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { joinRealSyncWaitlist } from "@/app/(app)/dashboard/waitlist-actions";

/** "Join Waitlist for Real Sync" card on the dashboard. */
export function WaitlistCard({ initiallyJoined = false }: { initiallyJoined?: boolean }) {
  const [joined, setJoined] = useState(initiallyJoined);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <section
      aria-labelledby="waitlist-heading"
      className="flex flex-col gap-4 rounded-xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.08] to-transparent p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-indigo-400/30 bg-indigo-500/10 text-indigo-300">
          <BellRing className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 id="waitlist-heading" className="text-sm font-medium text-white">
            Real bank sync is coming
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
            Automatically import transactions from your real accounts. Join the waitlist and we&apos;ll email you when
            it&apos;s ready.
          </p>
          {error && (
            <p role="alert" className="mt-1.5 text-xs text-rose-400">
              {error}
            </p>
          )}
        </div>
      </div>

      {joined ? (
        <span
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400"
          role="status"
        >
          <CircleCheck className="size-4" aria-hidden="true" />
          You&apos;re on the waitlist
        </span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              const result = await joinRealSyncWaitlist();
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setJoined(true);
              toast.success(result.alreadyJoined ? "You're already on the waitlist" : "You're on the waitlist", {
                description: `We'll email ${result.email} when real bank sync is ready.`,
              });
            })
          }
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-70"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Joining..." : "Join Waitlist for Real Sync"}
        </button>
      )}
    </section>
  );
}
