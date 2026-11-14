"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Compass, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

type NavItem = { label: string; icon: LucideIcon; href: string; matchPath?: string };

// Transactions is a section of the Overview page for now.
// `matchPath` marks which items count as "current" for highlighting.
export const navItems: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard", matchPath: "/dashboard" },
  { label: "Transactions", icon: ArrowLeftRight, href: "/dashboard#transactions" },
  { label: "AI Copilot", icon: Compass, href: "/copilot", matchPath: "/copilot" },
  { label: "Settings", icon: Settings, href: "/settings", matchPath: "/settings" },
];

export function isActive(item: NavItem, pathname: string | null): boolean {
  if (!item.matchPath || !pathname) return false;
  return pathname === item.matchPath || pathname.startsWith(`${item.matchPath}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {navItems.map((item) => {
        const { label, icon: Icon, href } = item;
        const active = isActive(item, pathname);
        return (
          <li key={label}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
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
