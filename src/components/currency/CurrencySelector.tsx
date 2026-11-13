"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CURRENCY_CODES, CURRENCY_INFO } from "@/lib/currency";
import { useCurrency } from "./currency-store";

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Display currency: ${CURRENCY_INFO[currency].name}`}
        className="flex h-9 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 pl-2 pr-2.5 text-sm text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
      >
        <span className="grid size-5 place-items-center rounded bg-zinc-800 text-xs font-medium text-white">
          {CURRENCY_INFO[currency].symbol}
        </span>
        <span className="font-medium tabular-nums">{currency}</span>
        <ChevronDown
          className={`size-3.5 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose display currency"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-2xl shadow-black/60"
        >
          <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Display currency
          </p>
          {CURRENCY_CODES.map((code) => {
            const info = CURRENCY_INFO[code];
            const selected = code === currency;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setCurrency(code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                  selected ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                }`}
              >
                <span className="grid size-6 place-items-center rounded border border-zinc-700 bg-zinc-950 text-xs font-medium">
                  {info.symbol}
                </span>
                <span className="flex-1">
                  <span className="font-medium">{code}</span>
                  <span className="ml-2 text-xs text-zinc-500">{info.name}</span>
                </span>
                {selected && <Check className="size-4 text-zinc-300" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
