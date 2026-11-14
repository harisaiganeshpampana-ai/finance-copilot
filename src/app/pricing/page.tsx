import type { Metadata } from "next";
import { PricingPlans } from "@/components/marketing/PricingPlans";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple pricing for CalmOwe. Start free, upgrade to Pro for unlimited AI chat, bank accounts and debt payoff plans.",
};

export default function PricingPage() {
  return (
    <div className="min-h-full flex-1 bg-zinc-950 text-zinc-100 antialiased">
      <SiteHeader />
      <main className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-80 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-zinc-500">Pricing</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tighter text-white sm:text-5xl">
              Simple pricing. Clear finances.
            </h1>
            <p className="mt-4 text-zinc-400">
              Start free. Upgrade when you want unlimited answers and a plan to pay off your debt.
            </p>
          </div>

          <PricingPlans />

          <p className="mx-auto mt-14 max-w-2xl text-center text-xs leading-relaxed text-zinc-600">
            Prices exclude applicable taxes. You can cancel a paid plan at any time. CalmOwe provides cash-flow and debt
            guidance, not investment advice.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
