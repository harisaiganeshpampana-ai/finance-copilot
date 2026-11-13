import type { Metadata } from "next";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Car,
  Coffee,
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
import { CopilotBar } from "@/components/dashboard/CopilotBar";
import { SpendingChart } from "@/components/dashboard/SpendingChart";
import {
  MOCK_AS_OF,
  MOCK_OPENING_BALANCE_CENTS,
  mockTransactions,
  type Category,
} from "@/data/mockTransactions";
import { formatCents, formatInrPaise, usdCentsToInrPaise, USD_TO_INR_DEMO_RATE } from "@/lib/balance";
import { dailySpending, formatPercent, monthTotals, percentChange, totalBalanceCents } from "@/lib/insights";

export const metadata: Metadata = {
  title: "Dashboard",
};

const inr = (cents: number) => formatInrPaise(usdCentsToInrPaise(cents));

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
};

function StatCard({
  label,
  icon: Icon,
  value,
  children,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
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
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white tabular-nums sm:text-[1.75rem]">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const balance = totalBalanceCents(MOCK_OPENING_BALANCE_CENTS, mockTransactions);
  const trend = percentChange(MOCK_OPENING_BALANCE_CENTS, balance);
  const { incomeCents, expensesCents } = monthTotals(mockTransactions, MOCK_AS_OF);
  const spending = dailySpending(mockTransactions, MOCK_AS_OF, 7);
  const spentLast7 = spending.reduce((sum, d) => sum + d.spendingCents, 0);
  const chartData = spending.map((d) => ({ label: weekday.format(toDate(d.date)), dollars: d.spendingCents / 100 }));
  const transactions = [...mockTransactions].sort((a, b) => b.date.localeCompare(a.date));

  const trendUp = trend !== null && trend >= 0;
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Total Balance" icon={Wallet} value={formatCents(balance)}>
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
            <span>vs. start of month</span>
            <span className="basis-full tabular-nums" title={`Fixed demo rate: ₹${USD_TO_INR_DEMO_RATE} = $1, not live`}>
              ≈ {inr(balance)}
            </span>
          </StatCard>
          <StatCard label="Income" icon={ArrowDownLeft} value={formatCents(incomeCents)}>
            <span>This month</span>
            <span className="basis-full tabular-nums">≈ {inr(incomeCents)}</span>
          </StatCard>
          <StatCard label="Expenses" icon={ArrowUpRight} value={formatCents(expensesCents)}>
            <span>This month</span>
            <span className="basis-full tabular-nums">≈ {inr(expensesCents)}</span>
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
                {shortDate.format(toDate(MOCK_AS_OF))}
              </p>
            </div>
            <p className="text-right">
              <span className="block text-xl font-semibold tracking-tight text-white tabular-nums">
                {formatCents(spentLast7)}
              </span>
              <span className="text-xs text-zinc-500">total spent</span>
            </p>
          </div>
          <SpendingChart data={chartData} />
        </section>

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
            <span className="text-xs text-zinc-500">{transactions.length} this month</span>
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
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                      <p className={`font-medium ${isIncome ? "text-emerald-400" : "text-zinc-100"}`}>
                        {isIncome ? "+" : ""}
                        {formatCents(t.amountCents)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {isIncome ? "+" : ""}
                        {inr(t.amountCents)}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <p className="text-center text-xs text-zinc-600">
          Rupee amounts use a fixed demo rate of ₹{USD_TO_INR_DEMO_RATE} = $1, not a live exchange rate.
        </p>
      </div>

      <CopilotBar />
    </main>
  );
}
