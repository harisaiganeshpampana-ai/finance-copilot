"use client";

import { createContext, type ReactNode, useCallback, useContext, useSyncExternalStore } from "react";
import { MOCK_EXCHANGE_RATES } from "@/data/mockTransactions";
import { convertMinor, type CurrencyCode, formatMinorUnits, isCurrencyCode } from "@/lib/currency";

// The currency the user's stored amounts are in (USD by default; INR for an uploaded Indian
// bank statement). Amounts are converted from this to the selected display currency.
const DataCurrencyContext = createContext<CurrencyCode>("USD");

export function DataCurrencyProvider({ currency, children }: { currency: CurrencyCode; children: ReactNode }) {
  return <DataCurrencyContext.Provider value={currency}>{children}</DataCurrencyContext.Provider>;
}

// One app-wide store for the selected display currency. Every component that
// calls useCurrency() re-renders instantly when it changes; no reload needed.
// The choice is remembered in this browser (localStorage) when storage is available.

const STORAGE_KEY = "calmowe.currency";
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
  const base = useContext(DataCurrencyContext);
  const setCurrency = useCallback((code: CurrencyCode) => {
    if (isCurrencyCode(code)) write(code);
  }, []);
  /** Stored minor units (in the data currency) -> display currency minor units. */
  const convert = useCallback((minor: number) => convertMinor(minor, base, currency, MOCK_EXCHANGE_RATES), [base, currency]);
  const format = useCallback(
    (minor: number, options?: { decimals?: 0 | 2 }) => formatMinorUnits(convert(minor), currency, options),
    [convert, currency],
  );
  return { currency, base, setCurrency, convert, format, rates: MOCK_EXCHANGE_RATES };
}

/** Renders a stored amount in the selected currency. `signed` adds "+" to positive amounts. */
export function Money({ cents, signed = false }: { cents: number; signed?: boolean }) {
  const { format } = useCurrency();
  return (
    <>
      {signed && cents > 0 ? "+" : ""}
      {format(cents)}
    </>
  );
}
