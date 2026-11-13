import { Menu, UserRound } from "lucide-react";
import { Toaster } from "sonner";
import { Logo } from "@/components/Logo";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { NavLinks } from "@/components/dashboard/nav";
import { mockUser } from "@/data/mockUser";

// Shared app frame (sidebar + top bar) for /dashboard and /settings.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex-1 bg-zinc-950 text-zinc-100 antialiased">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-zinc-800/80 bg-zinc-950 lg:flex">
        <div className="flex h-16 items-center border-b border-zinc-800/80 px-5">
          <Logo />
        </div>
        <nav className="flex-1 p-3" aria-label="Dashboard">
          <NavLinks />
        </nav>
        <div className="m-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs font-medium text-zinc-300">Demo mode</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Showing sample data. No bank account is connected.
          </p>
        </div>
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
                </nav>
              </details>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
                  <span className="sm:hidden" aria-hidden="true">
                    Hi, {mockUser.firstName}
                  </span>
                  <span className="sr-only sm:not-sr-only">Welcome back, {mockUser.firstName}</span>
                </h1>
                <p className="hidden text-xs text-zinc-500 sm:block">Here&apos;s where your money stands today.</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400 md:inline">
                Demo data
              </span>
              <CurrencySelector />
              <button
                type="button"
                className="grid size-9 place-items-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                aria-label={`Account: ${mockUser.fullName}`}
                title={mockUser.fullName}
              >
                <UserRound className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {children}
      </div>

      {/* Top-right, below the header, so toasts never cover the Save bar */}
      <Toaster theme="dark" position="top-right" offset={{ top: 76, right: 24 }}
        mobileOffset={{ top: 72, right: 16, left: 16 }}
        toastOptions={{ className: "font-sans" }} />
    </div>
  );
}
