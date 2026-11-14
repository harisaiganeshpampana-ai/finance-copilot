"use client";

import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/components/currency/currency-store";
import { formatMinorUnits } from "@/lib/currency";
import type { StatementImportResult, UploadStatementResponse } from "@/lib/statement-types";

/** Same limit as the server (the server re-checks everything; this is only for quick feedback). */
export const CLIENT_MAX_BYTES = 2 * 1024 * 1024;

const longDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const formatPeriod = (start: string, end: string) =>
  `${longDate.format(new Date(`${start}T00:00:00Z`))} – ${longDate.format(new Date(`${end}T00:00:00Z`))}`;

/** Quick checks before uploading. Returns an error message, or null if the file looks fine. */
export function checkStatementFile(file: { name: string; size: number }): string | null {
  if (!/\.csv$/i.test(file.name)) return "Please choose a .csv file. In Canara net banking, download your statement as CSV.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > CLIENT_MAX_BYTES) return "That file is too large. The limit is 2 MB.";
  return null;
}

type Stage =
  | { name: "pick"; error?: string }
  | { name: "uploading"; fileName: string }
  | { name: "done"; result: StatementImportResult };

function UploadStatementModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { setCurrency } = useCurrency();
  const [stage, setStage] = useState<Stage>({ name: "pick" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const busy = stage.name === "uploading";
  const busyRef = useRef(false); // read by the Escape handler

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const upload = useCallback(async (file: File) => {
    const problem = checkStatementFile(file);
    if (problem) {
      setStage({ name: "pick", error: problem });
      return;
    }
    setStage({ name: "uploading", fileName: file.name });
    busyRef.current = true;
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/statements/upload", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as UploadStatementResponse | null;
      if (!data || !data.ok) {
        setStage({ name: "pick", error: data && !data.ok ? data.error : "Couldn't upload your statement. Please try again." });
        return;
      }
      setStage({ name: "done", result: data.result });
    } catch {
      setStage({ name: "pick", error: "Couldn't reach CalmOwe. Check your connection and try again." });
    } finally {
      busyRef.current = false;
    }
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !busy) void upload(file);
  };

  const finish = (result: StatementImportResult) => {
    setCurrency(result.currency); // show the statement in rupees
    router.refresh();
    onClose();
    toast.success("Your audit is ready", { description: "Dashboard and AI Copilot now use your statement." });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={busy ? undefined : onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-statement-title"
        className="relative w-full max-w-lg overflow-hidden rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-indigo-950/40 sm:rounded-2xl"
      >
        {/* Soft top glow */}
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-indigo-500/20 via-violet-500/5 to-transparent blur-2xl"
          aria-hidden="true"
        />
        <div className="relative p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
                <FileSpreadsheet className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-indigo-300/80">Monthly Financial Audit</p>
                <h2 id="upload-statement-title" className="text-lg font-semibold tracking-tight text-white">
                  Upload bank statement
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-40"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {stage.name === "done" ? (
            <AuditReady result={stage.result} onFinish={() => finish(stage.result)} />
          ) : (
            <>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                Upload your Canara Bank statement as a CSV file. CalmOwe reads every transaction, sorts it into categories and
                prepares your audit in seconds.
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!busy) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                data-testid="statement-dropzone"
                className={`mt-5 rounded-xl border border-dashed p-6 text-center transition-all ${
                  dragging
                    ? "border-indigo-400/70 bg-indigo-500/10 shadow-[0_0_0_4px_rgba(129,140,248,0.08)]"
                    : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-600"
                }`}
              >
                {stage.name === "uploading" ? (
                  <div role="status" className="flex flex-col items-center gap-3 py-2">
                    <Loader2 className="size-7 animate-spin text-indigo-300" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-white">Analysing your statement...</p>
                      <p className="mt-0.5 max-w-xs truncate text-xs text-zinc-500">{stage.fileName}</p>
                    </div>
                    <div className="h-1 w-40 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                      <Upload className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">Drag and drop your CSV here</p>
                      <p className="mt-0.5 text-xs text-zinc-500">Canara Bank CSV &middot; up to 2 MB</p>
                    </div>
                    <button
                      ref={primaryRef}
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="mt-1 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
                    >
                      Choose file
                    </button>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label="Bank statement CSV file"
                  data-testid="statement-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = ""; // allow choosing the same file again
                    if (file) void upload(file);
                  }}
                />
              </div>

              {stage.name === "pick" && stage.error && (
                <p role="alert" className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                  {stage.error}
                </p>
              )}

              <ul className="mt-5 grid gap-2.5 text-xs text-zinc-400 sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  Stored only in your account, never shared or sold.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  No bank login needed. Uploading again never creates duplicates.
                </li>
              </ul>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AuditReady({ result, onFinish }: { result: StatementImportResult; onFinish: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const money = (minor: number) => formatMinorUnits(minor, result.currency, { decimals: 0 });
  const total = result.imported + result.alreadyUploaded;
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 text-emerald-400">
        <CheckCircle2 className="size-5" aria-hidden="true" />
        <p className="text-sm font-medium">
          {result.imported > 0
            ? `${result.imported} new transaction${result.imported === 1 ? "" : "s"} imported`
            : "This statement was already uploaded"}
        </p>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {total} transaction{total === 1 ? "" : "s"} found
        {result.alreadyUploaded > 0 && result.imported > 0 ? `, ${result.alreadyUploaded} already in your account` : ""}
        {result.skipped > 0 ? ` · ${result.skipped} non-transaction line${result.skipped === 1 ? "" : "s"} ignored` : ""}
      </p>

      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          <dt className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <CalendarRange className="size-3.5" aria-hidden="true" /> Period
          </dt>
          <dd className="mt-1 text-xs font-medium text-zinc-100">{formatPeriod(result.periodStart, result.periodEnd)}</dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          <dt className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <ArrowDownLeft className="size-3.5" aria-hidden="true" /> Money in
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-emerald-400" data-testid="audit-money-in">
            {money(result.moneyInMinor)}
          </dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          <dt className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <ArrowUpRight className="size-3.5" aria-hidden="true" /> Money out
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-100" data-testid="audit-money-out">
            {money(result.moneyOutMinor)}
          </dd>
        </div>
      </dl>

      <button
        ref={ref}
        type="button"
        onClick={onFinish}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        View my audit
      </button>
    </div>
  );
}

/** The premium "Upload Bank Statement" button; opens the upload modal. */
export function UploadStatementButton({ label = "Upload Bank Statement" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg p-px text-sm font-medium text-white shadow-lg shadow-indigo-950/30 transition-transform hover:-translate-y-px"
      >
        <span
          className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 opacity-70 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
        <span className="relative inline-flex items-center gap-2 rounded-[7px] bg-zinc-950 px-4 py-2">
          {label === "Upload Bank Statement" ? (
            <Upload className="size-4 text-indigo-300" aria-hidden="true" />
          ) : (
            <RotateCcw className="size-4 text-indigo-300" aria-hidden="true" />
          )}
          {label}
        </span>
      </button>
      {open && <UploadStatementModal onClose={close} />}
    </>
  );
}
