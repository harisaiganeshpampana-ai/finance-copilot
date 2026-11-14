"use client";

import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { useCurrency } from "@/components/currency/currency-store";
import { checkoutSoon, PLANS, type PlanId } from "@/components/marketing/PricingPlans";

/** Current plan + upgrade options inside Settings. Uses the same plan data as /pricing. */
export function BillingSection({ currentPlan }: { currentPlan: PlanId }) {
  const { currency } = useCurrency();
  const priceCurrency = currency === "INR" ? "INR" : "USD";
  const current = PLANS.find((p) => p.id === currentPlan) ?? PLANS[0];

  return (
    <div className="divide-y divide-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div>
          <p className="text-xs text-zinc-500">Current plan</p>
          <p className="mt-1 flex items-center gap-2 text-base font-semibold text-white" data-testid="current-plan">
            {current.name}
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              {current.price ? `${current.price[priceCurrency]}${current.id === "basic" ? "" : "/mo"}` : "Custom"}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{current.tagline}</p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-white"
        >
          Compare all plans
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === current.id;
          return (
            <div
              key={plan.id}
              aria-label={`${plan.name} plan`}
              role="group"
              className={`flex flex-col rounded-xl border p-4 ${
                plan.featured && !isCurrent
                  ? "border-indigo-400/50 bg-indigo-500/[0.06] shadow-[0_0_30px_-12px_rgba(129,140,248,0.6)]"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{plan.name}</p>
                {plan.featured && (
                  <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                    Most popular
                  </span>
                )}
              </div>
              <p className="mt-2 text-xl font-semibold tracking-tight text-white tabular-nums" data-testid={`settings-price-${plan.id}`}>
                {plan.price ? plan.price[priceCurrency] : "Custom"}
                {plan.price && plan.id !== "basic" && <span className="ml-1 text-xs font-normal text-zinc-500">/mo</span>}
              </p>
              <ul className="mt-3 flex-1 space-y-1.5">
                {plan.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-zinc-400">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="mt-4 rounded-md border border-zinc-800 px-3 py-1.5 text-center text-xs font-medium text-zinc-500">
                  Current plan
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => checkoutSoon(plan.name)}
                  className={`mt-4 rounded-md px-3 py-1.5 text-center text-xs font-medium transition-colors ${
                    plan.featured
                      ? "bg-white text-zinc-950 hover:bg-zinc-200"
                      : "border border-zinc-700 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800"
                  }`}
                >
                  {plan.id === "enterprise" ? "Contact sales" : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
