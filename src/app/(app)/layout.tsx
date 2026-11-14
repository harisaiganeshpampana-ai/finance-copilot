import Link from "next/link";
import { Menu, UserRound } from "lucide-react";
import { Toaster } from "sonner";
import { Logo } from "@/components/Logo";
import { LogoutButton, SidebarUser, UserGreeting } from "@/components/auth/UserMenu";
import { SessionProviders } from "@/components/auth/SessionProviders";
import { BankConnectionCard, DataSourcePill } from "@/components/bank/BankConnection";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { NavLinks } from "@/components/dashboard/nav";

// Shared app frame (sidebar + top bar) for /dashboard, /copilot and /settings.
// These routes require a login (see src/proxy.ts).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProviders>
      <div className="min-h-full flex-1 bg-zinc-950 text-zinc-100 antialiased">
        {/* Sidebar (desktop) */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-zinc-800/80 bg-zinc-950 lg:flex">
          <div className="flex h-16 items-center border-b border-zinc-800/80 px-5">
            <Logo />
          </div>
          <nav className="flex-1 overflow-y-auto p-3" aria-label="Dashboard">
            <NavLinks />
          </nav>
          <div className="p-3" data-testid="sidebar-bank">
            <BankConnectionCard />
          </div>
          <SidebarUser />
        </aside>

        <div className="flex min-h-screen flex-col lg:pl-64">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                {/* Mobile menu: native <details>, no client JavaScript needed */}
                <details className="relative lg:hidden">
                  <summary
                    className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-zinc-800 text-zinc-300 [&::-webkit-details-marker]:hidden"
                    aria-label="Open navigation"
                  >
                    <Menu className="size-4" aria-hidden="true" />
                  </summary>
                  <nav
                    className="absolute left-0 mt-2 w-60 rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-2xl"
                    aria-label="Dashboard mobile"
                  >
                    <NavLinks />
                    <div className="mt-2 border-t border-zinc-800 pt-2">
                      <BankConnectionCard />
                    </div>
                    <div className="mt-2 border-t border-zinc-800 pt-2">
                      <LogoutButton />
                    </div>
                  </nav>
                </details>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
                    <UserGreeting />
                  </h1>
                  <p className="hidden text-xs text-zinc-500 sm:block">Here&apos;s where your money stands today.</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <DataSourcePill />
                <CurrencySelector />
                <Link
                  href="/settings"
                  className="grid size-9 place-items-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                  aria-label="Account settings"
                  title="Account settings"
                >
                  <UserRound className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </header>

          {children}
        </div>

        {/* Top-right, below the header, so toasts never cover the Save bar */}
        <Toaster
          theme="dark"
          position="top-right"
          offset={{ top: 76, right: 24 }}
          mobileOffset={{ top: 72, right: 16, left: 16 }}
          toastOptions={{ className: "font-sans" }}
        />
      </div>
    </SessionProviders>
  );
}
