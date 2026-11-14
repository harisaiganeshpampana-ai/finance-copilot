import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/Logo";

// Shared top navigation for public pages (landing, pricing, legal).
export const marketingLinks = [
  { label: "Features", href: "/#features" },
  { label: "Security", href: "/#security" },
  { label: "Pricing", href: "/pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Logo />

        <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          {marketingLinks.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-white">
              {l.label}
            </Link>
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
            {marketingLinks.map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                {l.label}
              </Link>
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
