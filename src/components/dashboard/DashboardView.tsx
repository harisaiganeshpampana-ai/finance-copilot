import {
  ArrowDownLeft,
  ArrowUpRight,
  Car,
  CircleDashed,
  Coffee,
  FileSpreadsheet,
  House,
  Landmark,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Tv,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { DataCurrencyProvider, Money } from "@/components/currency/currency-store";
import { SpendingChart } from "@/components/dashboard/SpendingChart";
import { GenerateSampleDataButton } from "@/components/dashboard/GenerateSampleDataButton";
import { UploadStatementButton } from "@/components/dashboard/UploadStatement";
import { WaitlistCard } from "@/components/dashboard/WaitlistCard";
import { type Category, type FinancialData, MOCK_EXCHANGE_RATES, type StatementInfo } from "@/data/mockTransactions";
import { formatPeriod } from "@/lib/statement-format";
import { dailySpending, formatPercent, monthTotals, percentChange, totalBalanceCents } from "@/lib/insights";

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

const categoryMeta: Record<Category, { label: string; icon: LucideIcon }> = {
  income: { label: "Income", icon: Landmark },
  housing: { label: "Housing", icon: House },
  groceries: { label: "Groceries", icon: ShoppingCart },
  dining: { label: "Dining", icon: Coffee },
  transport: { label: "Transport", icon: Car },
  shopping: { label: "Shopping", icon: ShoppingBag },
  utilities: { label: "Utilities", icon: Zap },
  subscriptions: { label: "Subscriptions", icon: Tv },
  other: { label: "Other", icon: CircleDashed },
};

/** Top bar: what the data is (uploaded statement or sample data) and the upload button. */
function DataSourceBar({ statement }: { statement?: StatementInfo }) {
  return (
    <section
      className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-zinc-900/40 to-indigo-950/30 p-5 sm:flex-row sm:items-center sm:justify-between"
      data-testid="data-source-bar"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
          <FileSpreadsheet className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-indigo-300/80">Monthly Financial Audit</p>
          {statement ? (
            <>
              <p className="truncate text-sm font-medium text-white">
                {statement.bank} &middot; {formatPeriod(statement.periodStart, statement.periodEnd)}
              </p>
              <p className="truncate text-xs text-zinc-500">From {statement.fileName}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-white">You&apos;re viewing sample data</p>
              <p className="text-xs text-zinc-500">Upload your bank statement to audit your real spending.</p>
            </>
          )}
        </div>
      </div>
      <UploadStatementButton label={statement ? "Upload another statement" : "Upload Bank Statement"} />
    </section>
  );
}

function StatCard({
  label,
  icon: Icon,
  value,
  children,
}: {
  label: string;
  icon: LucideIcon;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5" aria-label={label}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-zinc-400">{label}</h2>
        <span className="grid size-8 place-items-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p
        className="mt-3 text-2xl font-semibold tracking-tight text-white tabular-nums sm:text-[1.75rem]"
        data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {value}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">{children}</div>
    </section>
  );
}

/** The dashboard for one user's financial data (from MongoDB in the app, or mock data in tests). */
export function DashboardView({ data, waitlistJoined = false }: { data: FinancialData; waitlistJoined?: boolean }) {
  const { transactions: all, openingBalanceCents, asOf } = data;
  if (all.length === 0) return <EmptyDashboard waitlistJoined={waitlistJoined} />;

  const balance = totalBalanceCents(openingBalanceCents, all);
  const trend = percentChange(openingBalanceCents, balance);
  const { incomeCents, expensesCents } = monthTotals(all, asOf);
  const spending = dailySpending(all, asOf, 7);
  const spentLast7 = spending.reduce((sum, d) => sum + d.spendingCents, 0);
  const chartData = spending.map((d) => ({ label: weekday.format(toDate(d.date)), minor: d.spendingCents }));
  const transactions = [...all].sort((a, b) => b.date.localeCompare(a.date));

  const trendUp = trend !== null && trend >= 0;
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;

  return (
    <DataCurrencyProvider currency={data.currency ?? "USD"}>
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <DataSourceBar statement={data.statement} />

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Total Balance" icon={Wallet} value={<Money cents={balance} />}>
            {trend !== null && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${
                  trendUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                }`}
                data-testid="balance-trend"
              >
                <TrendIcon className="size-3" aria-hidden="true" />
                {formatPercent(trend)}
              </span>
            )}
            <span>vs. opening balance</span>
          </StatCard>
          <StatCard label="Income" icon={ArrowDownLeft} value={<Money cents={incomeCents} />}>
            <span>This month</span>
          </StatCard>
          <StatCard label="Expenses" icon={ArrowUpRight} value={<Money cents={expensesCents} />}>
            <span>This month</span>
          </StatCard>
        </div>

        {/* Spending chart */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5" aria-labelledby="spending-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="spending-heading" className="text-sm font-medium text-white">
                Spending
              </h2>
              <p className="text-xs text-zinc-500">
                Last 7 days &middot; {shortDate.format(toDate(spending[0].date))} to{" "}
                {shortDate.format(toDate(asOf))}
              </p>
            </div>
            <p className="text-right">
              <span className="block text-xl font-semibold tracking-tight text-white tabular-nums">
                <Money cents={spentLast7} />
              </span>
              <span className="text-xs text-zinc-500">total spent</span>
            </p>
          </div>
          <SpendingChart data={chartData} />
        </section>

        <WaitlistCard initiallyJoined={waitlistJoined} />

        {/* Transactions */}
        <section
          id="transactions"
          className="scroll-mt-20 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
          aria-labelledby="transactions-heading"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 id="transactions-heading" className="text-sm font-medium text-white">
              Recent transactions
            </h2>
            <span className="text-xs text-zinc-500">{transactions.length} {transactions.length === 1 ? "transaction" : "transactions"}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="sr-only sm:not-sr-only">
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Merchant
                </th>
                <th scope="col" className="hidden px-5 py-2.5 font-medium md:table-cell">
                  Category
                </th>
                <th scope="col" className="hidden px-5 py-2.5 font-medium sm:table-cell">
                  Date
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {transactions.map((t) => {
                const { label, icon: Icon } = categoryMeta[t.category];
                const isIncome = t.amountCents > 0;
                return (
                  <tr key={t.id} className="transition-colors hover:bg-zinc-800/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-full border ${
                            isIncome
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : "border-zinc-800 bg-zinc-900 text-zinc-400"
                          }`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-100">{t.merchant}</p>
                          <p className="text-xs text-zinc-500 sm:hidden">
                            {label} &middot; {shortDate.format(toDate(t.date))}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3 text-zinc-400 md:table-cell">{label}</td>
                    <td className="hidden whitespace-nowrap px-5 py-3 text-zinc-400 sm:table-cell">
                      {shortDate.format(toDate(t.date))}
                    </td>
                    <td
                      className={`whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums ${
                        isIncome ? "text-emerald-400" : "text-zinc-100"
                      }`}
                    >
                      <Money cents={t.amountCents} signed />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <p className="text-center text-xs text-zinc-600">
          {data.currency && data.currency !== "USD" ? `Your statement amounts are in ${data.currency}. ` : ""}
          Other currencies use fixed demo rates (1 USD = {MOCK_EXCHANGE_RATES.INR} INR, {MOCK_EXCHANGE_RATES.EUR} EUR,{" "}
          {MOCK_EXCHANGE_RATES.GBP} GBP), not live exchange rates.
        </p>
      </div>
    </main>
    </DataCurrencyProvider>
  );
}

/** Shown when the user has no transactions yet (e.g. accounts created before sample data existed). */
export function EmptyDashboard({ waitlistJoined = false }: { waitlistJoined?: boolean }) {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-200">
          <Wallet className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">No transactions yet</h2>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          Upload your bank statement for a Monthly Financial Audit, or load sample data to explore your dashboard and the AI
          Copilot.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <UploadStatementButton />
          <GenerateSampleDataButton />
        </div>
        <div className="mt-12 w-full text-left">
          <WaitlistCard initiallyJoined={waitlistJoined} />
        </div>
      </div>
    </main>
  );
}

/** Placeholder while the user's data loads. */
export function DashboardSkeleton() {
  return (
    <main className="flex flex-1 flex-col" aria-busy="true" aria-label="Loading your dashboard">
      <div className="mx-auto w-full max-w-6xl flex-1 animate-pulse space-y-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 rounded-xl border border-zinc-800 bg-zinc-900/40" />
          ))}
        </div>
        <div className="h-80 rounded-xl border border-zinc-800 bg-zinc-900/40" />
        <div className="h-96 rounded-xl border border-zinc-800 bg-zinc-900/40" />
      </div>
    </main>
  );
}

/** Shown if the user's data couldn't be loaded (e.g. the database is unreachable). */
export function DashboardError() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-white">Couldn&apos;t load your data</h2>
        <p className="mt-2 text-sm text-zinc-400">Something went wrong reaching your account data. Please refresh to try again.</p>
      </div>
    </main>
  );
}
