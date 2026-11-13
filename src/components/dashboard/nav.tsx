import Link from "next/link";
import { ArrowLeftRight, Compass, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

type NavItem = { label: string; icon: LucideIcon; href?: string; active?: boolean };

// Only the Overview page exists so far. Transactions and AI Copilot jump to their
// sections on it; Settings is shown as "Soon" rather than linking to a missing page.
export const navItems: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard", active: true },
  { label: "Transactions", icon: ArrowLeftRight, href: "#transactions" },
  { label: "AI Copilot", icon: Compass, href: "#copilot" },
  { label: "Settings", icon: Settings },
];

export function NavLinks() {
  return (
    <ul className="space-y-1">
      {navItems.map(({ label, icon: Icon, href, active }) => {
        const base = "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors";
        if (!href) {
          return (
            <li key={label}>
              <span aria-disabled="true" className={`${base} cursor-not-allowed text-zinc-600`}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
                <span className="ml-auto rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                  Soon
                </span>
              </span>
            </li>
          );
        }
        return (
          <li key={label}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`${base} ${
                active
                  ? "bg-zinc-800/70 font-medium text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
