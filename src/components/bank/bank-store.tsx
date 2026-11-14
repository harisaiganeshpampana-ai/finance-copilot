"use client";

import { useCallback, useSyncExternalStore } from "react";

// App-wide bank connection state for the UI. The source of truth for real (Plaid) connections
// is the user's MongoDB document; the sidebar syncs this store from the server on load.
// "demo" connections (simulated, when Plaid isn't configured) live only in this browser.

export type ConnectionMode = "sandbox" | "production" | "demo";
export type BankConnection = { name: string; account: string; last4: string; mode: ConnectionMode };

export const DEMO_BANK: BankConnection = { name: "Meridian Bank", account: "Checking", last4: "4821", mode: "demo" };

const STORAGE_KEY = "calmowe.bankConnection";
const LEGACY_KEY = "calmowe.bankConnected"; // older boolean flag
const listeners = new Set<() => void>();
let memoryFallback: string | null = null;

// useSyncExternalStore needs a stable snapshot, so parse once per raw value.
let lastRaw: string | null | undefined;
let lastParsed: BankConnection | null = null;

function parse(raw: string | null): BankConnection | null {
  if (raw === lastRaw) return lastParsed;
  lastRaw = raw;
  try {
    const v = raw ? JSON.parse(raw) : null;
    lastParsed =
      v && typeof v.name === "string" && typeof v.last4 === "string" && (v.mode === "sandbox" || v.mode === "production" || v.mode === "demo")
        ? { name: v.name.slice(0, 80), account: String(v.account ?? "Account").slice(0, 40), last4: v.last4.slice(-4), mode: v.mode }
        : null;
  } catch {
    lastParsed = null;
  }
  return lastParsed;
}

function readRaw(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) return raw;
    if (window.localStorage.getItem(LEGACY_KEY) === "true") return JSON.stringify(DEMO_BANK);
    return memoryFallback;
  } catch {
    return memoryFallback;
  }
}

function write(connection: BankConnection | null): void {
  const raw = connection ? JSON.stringify(connection) : null;
  memoryFallback = raw;
  try {
    window.localStorage.removeItem(LEGACY_KEY);
    if (raw) window.localStorage.setItem(STORAGE_KEY, raw);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable; memoryFallback keeps the state for this session.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  const onStorage = (e: StorageEvent) => (e.key === STORAGE_KEY || e.key === LEGACY_KEY) && notify();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

/** Test helper: back to "not connected". */
export function resetBankForTests(): void {
  write(null);
}

export function useBankConnection() {
  const bank = useSyncExternalStore(
    subscribe,
    () => parse(readRaw()),
    () => null,
  );
  const connect = useCallback((connection: BankConnection = DEMO_BANK) => write(connection), []);
  const disconnect = useCallback(() => write(null), []);
  return { connected: bank !== null, bank, connect, disconnect };
}
