import Link from "next/link";
import { Logo } from "@/components/Logo";

// Centered, branded layout for /login and /signup.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100 antialiased">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:56px_56px] opacity-30 [mask-image:radial-gradient(ellipse_at_top,black_15%,transparent_65%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden="true"
      />

      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Logo />
      </header>

      <main className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-8 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="relative pb-8 text-center text-xs text-zinc-600">
        <Link href="/terms" className="hover:text-zinc-400">
          Terms of Service
        </Link>
        <span className="mx-2" aria-hidden="true">
          &middot;
        </span>
        <Link href="/privacy" className="hover:text-zinc-400">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
