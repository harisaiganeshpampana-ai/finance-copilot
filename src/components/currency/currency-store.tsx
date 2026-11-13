"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MOCK_EXCHANGE_RATES } from "@/data/mockTransactions";
import { type CurrencyCode, formatUsdCentsAs, isCurrencyCode } from "@/lib/currency";

// One app-wide store for the selected display currency. Every component that
// calls useCurrency() re-renders instantly when it changes; no reload needed.
// The choice is remembered in this browser (localStorage) when storage is available.

const STORAGE_KEY = "moneypulse.currency";
const DEFAULT_CURRENCY: CurrencyCode = "USD";
const listeners = new Set<() => void>();
let memoryFallback: CurrencyCode = DEFAULT_CURRENCY; // used if localStorage is blocked

function read(): CurrencyCode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isCurrencyCode(saved) ? saved : memoryFallback;
  } catch {
    return memoryFallback;
  }
}

function write(code: CurrencyCode): void {
  memoryFallback = code;
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Storage unavailable (private mode etc.); memoryFallback still holds the choice.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && notify(); // sync across tabs
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

/** Test helper: reset to the default currency. */
export function resetCurrencyForTests(): void {
  write(DEFAULT_CURRENCY);
}

export function useCurrency() {
  const currency = useSyncExternalStore(subscribe, read, () => DEFAULT_CURRENCY);
  const setCurrency = useCallback((code: CurrencyCode) => {
    if (isCurrencyCode(code)) write(code);
  }, []);
  const format = useCallback(
    (usdCents: number, options?: { decimals?: 0 | 2 }) =>
      formatUsdCentsAs(usdCents, currency, MOCK_EXCHANGE_RATES, options),
    [currency],
  );
  return { currency, setCurrency, format, rates: MOCK_EXCHANGE_RATES };
}

/** Renders a US-cents amount in the selected currency. `signed` adds "+" to positive amounts. */
export function Money({ cents, signed = false }: { cents: number; signed?: boolean }) {
  const { format } = useCurrency();
  return (
    <>
      {signed && cents > 0 ? "+" : ""}
      {format(cents)}
    </>
  );
}
