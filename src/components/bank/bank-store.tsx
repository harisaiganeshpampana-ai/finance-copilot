"use client";

import { useCallback, useSyncExternalStore } from "react";

// App-wide bank connection state for the UI. The source of truth for real (Plaid) connections
// is the user's MongoDB document; the sidebar syncs this store from the server on load.
// "demo" connections (simulated, when Plaid isn't configured) live only in this browser.
// Everything here is stored PER ACCOUNT (see setBankScope), so one person's bank never shows
// up for another account logged in on the same browser.

export type ConnectionMode = "sandbox" | "production" | "demo";
export type BankConnection = { name: string; account: string; last4: string; mode: ConnectionMode };

export const DEMO_BANK: BankConnection = { name: "Meridian Bank", account: "Checking", last4: "4821", mode: "demo" };

const STORAGE_PREFIX = "calmowe.bankConnection";
// Old keys shared by everyone using this browser (before connections were per account).
const LEGACY_KEYS = ["calmowe.bankConnected", "calmowe.bankConnection"];
const listeners = new Set<() => void>();
let memoryFallback: string | null = null;

// Whose connection this is (the logged-in user's email). Null until a user is known.
let scope: string | null = null;
const storageKey = () => (scope ? `${STORAGE_PREFIX}:${scope}` : null);

// useSyncExternalStore needs a stable snapshot, so parse once per raw value.
let lastRaw: string | null | undefined;
let lastParsed: BankConnection | null = null;

function parse(raw: string | null): BankConnection | null {
  if (raw === lastRaw) return lastParsed;
  lastRaw = raw;
  try {
    const v = raw ? JSON.parse(raw) : null;
    lastParsed =
      v &&
      typeof v.name === "string" &&
      typeof v.last4 === "string" &&
      (v.mode === "sandbox" || v.mode === "production" || v.mode === "demo")
        ? { name: v.name.slice(0, 80), account: String(v.account ?? "Account").slice(0, 40), last4: v.last4.slice(-4), mode: v.mode }
        : null;
  } catch {
    lastParsed = null;
  }
  return lastParsed;
}

function readRaw(): string | null {
  const key = storageKey();
  if (!key) return null; // no logged-in user known yet: show nothing
  try {
    return window.localStorage.getItem(key) ?? memoryFallback;
  } catch {
    return memoryFallback;
  }
}

function notify(): void {
  listeners.forEach((n) => n());
}

function write(connection: BankConnection | null): void {
  const raw = connection ? JSON.stringify(connection) : null;
  memoryFallback = raw;
  const key = storageKey();
  try {
    if (key && raw) window.localStorage.setItem(key, raw);
    else if (key) window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable; memoryFallback keeps the state for this session.
  }
  notify();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => e.key !== null && e.key.startsWith(STORAGE_PREFIX) && onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Sets which account the stored connection belongs to (the logged-in user's email). */
export function setBankScope(next: string | null | undefined): void {
  const normalized = next ? next.trim().toLowerCase() : null;
  if (normalized === scope) return;
  scope = normalized;
  memoryFallback = null;
  try {
    for (const k of LEGACY_KEYS) window.localStorage.removeItem(k);
  } catch {
    // ignore
  }
  notify();
}

/** The current connection, read fresh (never from a possibly stale render). */
export function readBankConnection(): BankConnection | null {
  return parse(readRaw());
}

/** Test helper: no user and nothing connected. */
export function resetBankForTests(): void {
  scope = null;
  memoryFallback = null;
  lastRaw = undefined;
  lastParsed = null;
  notify();
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
