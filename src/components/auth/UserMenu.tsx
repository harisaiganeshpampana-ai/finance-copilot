"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || "there";
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email || "";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

/** "Welcome back, <first name>" using the logged-in user's name. */
export function UserGreeting() {
  const { data } = useSession();
  const first = firstName(data?.user?.name);
  return (
    <>
      <span className="sm:hidden" aria-hidden="true">
        Hi, {first}
      </span>
      <span className="sr-only sm:not-sr-only">Welcome back, {first}</span>
    </>
  );
}

export function LogoutButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: "/login" });
      }}
      disabled={pending}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white disabled:opacity-60 ${className}`}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {pending ? "Logging out..." : "Log Out"}
    </button>
  );
}

/** Sidebar footer: who is logged in, plus Log Out. */
export function SidebarUser() {
  const { data } = useSession();
  const user = data?.user;
  return (
    <div className="border-t border-zinc-800/80 p-3">
      {user && (
        <div className="mb-1 flex items-center gap-3 px-3 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-200">
            {initials(user.name, user.email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
        </div>
      )}
      <LogoutButton />
    </div>
  );
}
