import type { Metadata } from "next";
import Link from "next/link";
import { mockTransactions } from "@/data/mockTransactions";
import {
  calculateBalanceCents,
  formatCents,
  formatInrPaise,
  USD_TO_INR_DEMO_RATE,
  usdCentsToInrPaise,
} from "@/lib/balance";

const inr = (cents: number) => formatInrPaise(usdCentsToInrPaise(cents));

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function Dashboard() {
  const balanceCents = calculateBalanceCents(mockTransactions);
  const transactions = [...mockTransactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex-1 bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight">
            <Link href="/" className="hover:opacity-80">
              MoneyPulse
            </Link>{" "}
            <span className="font-normal text-slate-500 dark:text-slate-400">Dashboard</span>
          </h1>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Demo data
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-lg">
          <p className="text-sm font-medium text-indigo-100">Balance</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums" data-testid="balance">
            {formatCents(balanceCents)}
          </p>
          <p className="mt-1 text-lg font-medium text-indigo-100 tabular-nums" data-testid="balance-inr">
            ≈ {inr(balanceCents)}
          </p>
          <p className="mt-2 text-xs text-indigo-200">
            Based on {transactions.length} mock transactions · ₹ at a fixed demo rate of ₹{USD_TO_INR_DEMO_RATE} = $1
            (not live)
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
            Recent transactions
          </h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((t) => {
              const isIncome = t.amountCents > 0;
              return (
                <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.merchant}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {dateFormatter.format(new Date(t.date))}
                    </p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p
                      className={`font-semibold ${
                        isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {isIncome ? "+" : ""}
                      {formatCents(t.amountCents)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isIncome ? "+" : ""}
                      {inr(t.amountCents)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
