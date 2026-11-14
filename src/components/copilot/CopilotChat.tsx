"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  CalendarDays,
  Compass,
  Loader2,
  ShoppingBag,
  SquarePen,
  TrendingDown,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { mockUser } from "@/data/mockUser";
import { MAX_QUESTION_CHARS, useCopilotChat } from "./useCopilotChat";

export const SUGGESTIONS: { icon: LucideIcon; text: string }[] = [
  { icon: ShoppingBag, text: "Can I afford a ₹5,000 purchase?" },
  { icon: CalendarDays, text: "Review my spending this week" },
  { icon: TrendingDown, text: "How do I pay off my debt faster?" },
];

export function CopilotChat() {
  const { messages, loading, send, clear } = useCopilotChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const empty = messages.length === 0 && !loading;

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Grow the input with its content (up to a limit).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const submit = (text: string) => {
    if (!text.trim() || loading) return;
    setDraft("");
    void send(text);
    inputRef.current?.focus();
  };

  return (
    // Full height of the viewport below the app top bar (4rem + 1px bottom border).
    <main className="flex h-[calc(100dvh-4rem-1px)] flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-white">
            <Compass className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">CalmOwe Copilot</h2>
            <p className="text-xs text-zinc-500">Answers based on your accounts and transactions</p>
          </div>
        </div>
        {!empty && (
          <button
            type="button"
            onClick={clear}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white disabled:opacity-50"
          >
            <SquarePen className="size-3.5" aria-hidden="true" />
            New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-2xl border border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-900 text-white shadow-lg">
              <Compass className="size-6" aria-hidden="true" />
            </span>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Hi {mockUser.firstName}, how can I help you with your money today?
            </h3>
            <p className="mt-3 max-w-md text-sm text-zinc-500">
              Ask about affordability, spending, upcoming bills or paying down debt. I&apos;ll use your actual numbers.
            </p>
            <div className="mt-8 grid w-full gap-2 sm:grid-cols-3" aria-label="Suggested questions">
              {SUGGESTIONS.map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => submit(text)}
                  className="group flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-white"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-zinc-500 group-hover:text-indigo-300" aria-hidden="true" />
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6" role="log" aria-live="polite" aria-label="Conversation">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p
                    className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-500 px-4 py-2.5 text-sm leading-relaxed text-white"
                    data-role="user"
                  >
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border ${
                      m.error ? "border-rose-500/30 bg-rose-500/10 text-rose-400" : "border-zinc-700 bg-zinc-900 text-zinc-200"
                    }`}
                    aria-hidden="true"
                  >
                    {m.error ? <TriangleAlert className="size-4" /> : <Compass className="size-4" />}
                  </span>
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md border px-4 py-2.5 text-sm leading-relaxed ${
                      m.error ? "border-rose-500/20 bg-rose-500/5 text-rose-300" : "border-zinc-800 bg-zinc-900/60 text-zinc-100"
                    }`}
                    data-role={m.error ? "error" : "assistant"}
                  >
                    {m.content}
                  </p>
                </div>
              ),
            )}
            {loading && (
              <div className="flex items-center gap-3" role="status">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                </span>
                <span className="flex items-center gap-1 text-sm text-zinc-500">
                  Thinking
                  <span className="inline-flex gap-0.5" aria-hidden="true">
                    <span className="size-1 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
                    <span className="size-1 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
                    <span className="size-1 animate-bounce rounded-full bg-zinc-500" />
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input, pinned to the bottom */}
      <div className="border-t border-zinc-800/80 bg-zinc-950 px-4 pb-4 pt-3 sm:px-6 lg:px-8">
        <form
          className="mx-auto max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
        >
          <label htmlFor="copilot-input" className="sr-only">
            Ask the AI Copilot
          </label>
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 pl-4 shadow-xl shadow-black/40 transition-colors focus-within:border-zinc-600">
            <textarea
              ref={inputRef}
              id="copilot-input"
              rows={1}
              value={draft}
              maxLength={MAX_QUESTION_CHARS}
              disabled={loading}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter adds a new line.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              placeholder="Ask about your cash flow or debt..."
              className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-white placeholder:text-zinc-500 focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!draft.trim() || loading}
              aria-label={loading ? "Sending question" : "Send question"}
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-zinc-950 transition-colors hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="size-4" aria-hidden="true" />}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-600">
            Guidance covers cash flow and debt only, not investments. Not financial advice.
          </p>
        </form>
      </div>
    </main>
  );
}
