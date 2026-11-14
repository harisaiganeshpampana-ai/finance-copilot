import Link from "next/link";
import { LogoMark } from "./LogoMark";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight text-white">
      <span className="grid size-7 place-items-center rounded-md bg-white text-zinc-950">
        <LogoMark className="size-[18px]" />
      </span>
      CalmOwe
    </Link>
  );
}
