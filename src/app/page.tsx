import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Compass,
  EyeOff,
  KeyRound,
  Lock,
  Menu,
  ServerCog,
  ShieldCheck,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { mockTransactions } from "@/data/mockTransactions";
import { calculateBalanceCents, formatCents } from "@/lib/balance";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
];

const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: "Bank-grade Security",
    body: "Read-only bank connections, encryption in transit and at rest, and credentials kept on our servers, never in your browser.",
  },
  {
    icon: Compass,
    title: "AI Financial Copilot",
    body: "Ask plain questions like “Can I cover rent this month?” and get answers grounded in your real cash flow. Guidance covers budgeting and debt, never investments.",
  },
  {
    icon: TrendingDown,
    title: "Smart Debt Payoff",
    body: "Compare avalanche and snowball strategies side by side. See which balance to pay first, the interest you save, and your debt-free date.",
  },
];

const securityPoints: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Lock, title: "Encrypted everywhere", body: "Data is encrypted in transit and at rest." },
  { icon: EyeOff, title: "Read-only access", body: "MoneyPulse can see balances. It can never move money." },
  { icon: KeyRound, title: "Secrets stay server-side", body: "Keys and tokens never reach the browser." },
  { icon: ServerCog, title: "Validated on the server", body: "Every request is checked before it is processed." },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
      <span className="grid size-7 place-items-center rounded-md bg-white text-zinc-950">
        <Activity className="size-4" strokeWidth={2.5} aria-hidden="true" />
      </span>
      MoneyPulse
    </Link>
  );
}

function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Logo />

        <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-white">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/dashboard" className="px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-white">
            Login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu: native <details>, no client JavaScript needed */}
        <details className="group relative md:hidden">
          <summary
            className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-zinc-800 text-zinc-300 [&::-webkit-details-marker]:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="block rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                {l.label}
              </a>
            ))}
            <Link href="/dashboard" className="block rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
              Login
            </Link>
            <Link
              href="/dashboard"
              className="mt-1 block rounded-md bg-white px-3 py-2 text-center text-sm font-medium text-zinc-950"
            >
              Get Started
            </Link>
          </div>
        </details>
      </nav>
    </header>
  );
}

function ProductPreview() {
  const balance = calculateBalanceCents(mockTransactions);
  const income = calculateBalanceCents(mockTransactions.filter((t) => t.amountCents > 0));
  const spending = calculateBalanceCents(mockTransactions.filter((t) => t.amountCents < 0));
  const recent = [...mockTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return (
    <div className="relative mx-auto mt-16 max-w-3xl">
      <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-zinc-700/60 to-transparent" aria-hidden="true" />
      <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-2xl backdrop-blur sm:p-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-zinc-700" />
            <span className="size-2.5 rounded-full bg-zinc-700" />
            <span className="size-2.5 rounded-full bg-zinc-700" />
          </div>
          <span className="text-xs text-zinc-500">Preview with demo data</span>
        </div>

        <div className="grid gap-3 pt-5 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs text-zinc-500">Balance</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-white tabular-nums">{formatCents(balance)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <ArrowDownLeft className="size-3.5 text-emerald-400" aria-hidden="true" /> Money in
            </p>
            <p className="mt-1 text-lg font-medium text-zinc-200 tabular-nums">{formatCents(income)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <ArrowUpRight className="size-3.5 text-zinc-400" aria-hidden="true" /> Money out
            </p>
            <p className="mt-1 text-lg font-medium text-zinc-200 tabular-nums">{formatCents(spending)}</p>
          </div>
        </div>

        <ul className="mt-3 divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-950/60 text-left">
          {recent.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="truncate text-zinc-300">{t.merchant}</span>
              <span className={`shrink-0 tabular-nums ${t.amountCents > 0 ? "text-emerald-400" : "text-zinc-400"}`}>
                {t.amountCents > 0 ? "+" : ""}
                {formatCents(t.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle grid + glow background */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-80 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400">
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          Cash flow and debt, in one place
        </p>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tighter text-white sm:text-6xl md:text-7xl">
          Take absolute control of your cash flow.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          See what&apos;s coming in, what&apos;s going out, and which debt to pay down first. MoneyPulse turns your
          accounts into one clear plan.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200 sm:w-auto"
          >
            Open the dashboard
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <a
            href="#features"
            className="inline-flex w-full items-center justify-center rounded-md border border-zinc-800 px-5 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white sm:w-auto"
          >
            See how it works
          </a>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-16 border-t border-zinc-800/80">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-zinc-500">Features</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Built for the decisions you make every month.
          </h2>
          <p className="mt-4 text-zinc-400">
            Know what you can spend, what&apos;s due, and where each extra payment does the most good.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <article key={title} className="bg-zinc-950 p-6 transition-colors hover:bg-zinc-900/60 sm:p-8">
              <div className="grid size-10 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-white">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-6 font-medium text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section id="security" className="scroll-mt-16 border-t border-zinc-800/80">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-medium text-zinc-500">Security</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Security is the foundation, not a feature.
          </h2>
          <p className="mt-4 max-w-lg text-zinc-400">
            Your financial data deserves the same care a bank gives it. Every part of MoneyPulse is designed around
            least access and strict validation.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {securityPoints.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <Icon className="size-5 text-zinc-300" aria-hidden="true" />
              <p className="mt-4 text-sm font-medium text-white">{title}</p>
              <p className="mt-1 text-sm text-zinc-400">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="border-t border-zinc-800/80">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-20 sm:px-6 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Know exactly where you stand.</h2>
          <p className="mt-2 text-zinc-400">Set up in minutes. Your first clear picture of the month, today.</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
        >
          Get Started
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-800/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-zinc-500 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <span>&copy; 2026 MoneyPulse</span>
        </div>
        <nav className="flex gap-6" aria-label="Footer">
          <a href="#features" className="hover:text-zinc-300">
            Features
          </a>
          <a href="#security" className="hover:text-zinc-300">
            Security
          </a>
          <Link href="/dashboard" className="hover:text-zinc-300">
            Dashboard
          </Link>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-xs text-zinc-600 sm:px-6">
        MoneyPulse provides cash-flow and debt guidance. It does not provide investment advice.
      </p>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-full flex-1 bg-zinc-950 text-zinc-100 antialiased selection:bg-white selection:text-zinc-950">
      <NavBar />
      <main>
        <Hero />
        <Features />
        <Security />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
