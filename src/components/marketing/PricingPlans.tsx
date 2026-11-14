"use client";

import Link from "next/link";
import { Building2, Check, Sparkles, User, type LucideIcon } from "lucide-react";
import { toast, Toaster } from "sonner";
import { useCurrency } from "@/components/currency/currency-store";

type PriceCurrency = "USD" | "INR";

type Plan = {
  id: "basic" | "pro" | "enterprise";
  name: string;
  icon: LucideIcon;
  tagline: string;
  price: Record<PriceCurrency, string> | null; // null = custom pricing
  period?: string;
  features: string[];
  cta: { label: string; kind: "link"; href: string } | { label: string; kind: "checkout" };
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    icon: User,
    tagline: "Get a clear picture of your money.",
    price: { USD: "$0", INR: "₹0" },
    period: "Free forever",
    features: ["Basic AI Copilot chat", "1 connected bank account", "Balance, income and spending dashboard", "Multi-currency view"],
    cta: { label: "Get started", kind: "link", href: "/dashboard" },
  },
  {
    id: "pro",
    name: "Pro",
    icon: Sparkles,
    tagline: "Everything you need to get out of debt faster.",
    price: { USD: "$9", INR: "₹499" },
    period: "per month",
    features: ["Everything in Basic", "Unlimited AI Copilot chat", "Unlimited connected bank accounts", "Debt payoff plans"],
    cta: { label: "Subscribe", kind: "checkout" },
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Building2,
    tagline: "For teams and families.",
    price: null,
    period: "Tailored to your needs",
    features: ["Everything in Pro", "Multiple members for teams and families", "Custom setup and billing"],
    cta: { label: "Subscribe", kind: "checkout" },
  },
];

export type PlanId = Plan["id"];

export function checkoutSoon(plan: string) {
  toast("Checkout coming soon", { description: `${plan} subscriptions open shortly. Nothing has been charged.` });
}

export function PricingPlans() {
  const { currency, setCurrency } = useCurrency();
  const priceCurrency: PriceCurrency = currency === "INR" ? "INR" : "USD";

  return (
    <>
      <div className="mx-auto mt-10 flex w-fit rounded-lg border border-zinc-800 bg-zinc-900/60 p-1" role="radiogroup" aria-label="Price currency">
        {(["USD", "INR"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={priceCurrency === c}
            onClick={() => setCurrency(c)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              priceCurrency === c ? "bg-white text-zinc-950" : "text-zinc-400 hover:text-white"
            }`}
          >
            {c === "USD" ? "$ USD" : "₹ INR"}
          </button>
        ))}
      </div>

      <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const card = (
            <article
              aria-labelledby={`plan-${plan.id}`}
              data-plan={plan.id}
              className={`relative flex h-full flex-col rounded-2xl p-7 ${
                plan.featured ? "bg-zinc-950" : "border border-zinc-800 bg-zinc-900/40"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-indigo-400/40 bg-indigo-500 px-3 py-1 text-xs font-medium text-white shadow-lg shadow-indigo-500/30">
                  Most popular
                </span>
              )}
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <h2 id={`plan-${plan.id}`} className="text-lg font-semibold text-white">
                  {plan.name}
                </h2>
              </div>
              <p className="mt-3 text-sm text-zinc-400">{plan.tagline}</p>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-white tabular-nums" data-testid={`price-${plan.id}`}>
                  {plan.price ? plan.price[priceCurrency] : "Custom"}
                </span>
                {plan.price && plan.id !== "basic" && <span className="text-sm text-zinc-500">/mo</span>}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{plan.period}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className={`mt-0.5 size-4 shrink-0 ${plan.featured ? "text-indigo-300" : "text-zinc-500"}`} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.cta.kind === "link" ? (
                <Link
                  href={plan.cta.href}
                  className="mt-8 block rounded-md border border-zinc-700 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:border-zinc-600 hover:bg-zinc-800"
                >
                  {plan.cta.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => checkoutSoon(plan.name)}
                  aria-label={`${plan.cta.label} to ${plan.name}`}
                  className={`mt-8 block w-full rounded-md px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                    plan.featured
                      ? "bg-white text-zinc-950 hover:bg-zinc-200"
                      : "border border-zinc-700 text-white hover:border-zinc-600 hover:bg-zinc-800"
                  }`}
                >
                  {plan.cta.label}
                </button>
              )}
            </article>
          );

          // The Pro card gets a glowing gradient border.
          return plan.featured ? (
            <div
              key={plan.id}
              className="relative rounded-2xl bg-gradient-to-b from-indigo-400 via-violet-500/60 to-indigo-500/20 p-px shadow-[0_0_60px_-12px_rgba(129,140,248,0.55)] lg:-my-3"
              data-glow="true"
            >
              {card}
            </div>
          ) : (
            <div key={plan.id}>{card}</div>
          );
        })}
      </div>

      <Toaster theme="dark" position="bottom-center" />
    </>
  );
}
