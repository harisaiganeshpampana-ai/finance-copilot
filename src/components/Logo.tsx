import Link from "next/link";
import { Activity } from "lucide-react";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight text-white">
      <span className="grid size-7 place-items-center rounded-md bg-white text-zinc-950">
        <Activity className="size-4" strokeWidth={2.5} aria-hidden="true" />
      </span>
      CalmOwe
    </Link>
  );
}
