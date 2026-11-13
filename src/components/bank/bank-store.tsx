"use client";

import { useCallback, useSyncExternalStore } from "react";

// App-wide bank connection state (demo). No real bank is contacted: "connecting"
// just flips this flag. Remembered in this browser via localStorage when available.
// Replace with the real provider flow (e.g. Plaid Link + a server-side token exchange).

export const DEMO_BANK = { name: "Meridian Bank", account: "Checking", last4: "4821" } as const;

const STORAGE_KEY = "moneypulse.bankConnected";
const listeners = new Set<() => void>();
let memoryFallback = false;

function read(): boolean {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === null ? memoryFallback : saved === "true";
  } catch {
    return memoryFallback;
  }
}

function write(connected: boolean): void {
  memoryFallback = connected;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(connected));
  } catch {
    // Storage unavailable; memoryFallback keeps the state for this session.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && notify();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

/** Test helper: back to "not connected". */
export function resetBankForTests(): void {
  write(false);
}

export function useBankConnection() {
  const connected = useSyncExternalStore(subscribe, read, () => false);
  const connect = useCallback(() => write(true), []);
  const disconnect = useCallback(() => write(false), []);
  return { connected, connect, disconnect, bank: DEMO_BANK };
}
