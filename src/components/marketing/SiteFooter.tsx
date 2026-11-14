import Link from "next/link";
import { Logo } from "@/components/Logo";

// Shared footer for public pages (landing, pricing, legal).
export const footerLinks = [
  { label: "Features", href: "/#features" },
  { label: "Security", href: "/#security" },
  { label: "Pricing", href: "/pricing" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-zinc-500 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <span>&copy; 2026 CalmOwe</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
          {footerLinks.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-zinc-300">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-xs text-zinc-600 sm:px-6">
        CalmOwe provides cash-flow and debt guidance. It does not provide investment advice.
      </p>
    </footer>
  );
}
