"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Compass, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { useCurrency } from "@/components/currency/currency-store";

type Message = { id: number; role: "user" | "assistant"; content: string; error?: boolean };

const MAX_CHARS = 500;
const HISTORY_TURNS = 10;

// The browser only sends the question (plus recent chat turns and display currency)
// to our own /api/chat route. The AI key and the financial data stay on the server.
export function CopilotBar() {
  const { currency } = useCurrency();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const text = question.trim();
    if (!text || loading) return;

    const history = messages
      .filter((m) => !m.error)
      .slice(-HISTORY_TURNS)
      .map(({ role, content }) => ({ role, content }));

    setMessages((m) => [...m, { id: nextId.current++, role: "user", content: text }]);
    setQuestion("");
    setLoading(true);

    let reply: Message;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, currency }),
      });
      const data: { reply?: unknown; error?: unknown } = await res.json().catch(() => ({}));
      if (res.ok && typeof data.reply === "string") {
        reply = { id: nextId.current++, role: "assistant", content: data.reply };
      } else {
        const msg = typeof data.error === "string" ? data.error : "The Copilot couldn't answer right now. Please try again.";
        reply = { id: nextId.current++, role: "assistant", content: msg, error: true };
      }
    } catch {
      reply = {
        id: nextId.current++,
        role: "assistant",
        content: "Couldn't reach the Copilot. Check your connection and try again.",
        error: true,
      };
    }
    setMessages((m) => [...m, reply]);
    setLoading(false);
  };

  const hasConversation = messages.length > 0 || loading;

  return (
    <div id="copilot" className="sticky bottom-0 z-20 scroll-mt-20 px-4 pb-4 pt-8 sm:px-6 lg:px-8">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-3xl">
        {hasConversation && (
          <section
            aria-label="AI Copilot conversation"
            className="mb-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-2xl shadow-black/50 backdrop-blur"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
              <p className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                <Compass className="size-3.5" aria-hidden="true" />
                AI Copilot
              </p>
              <button
                type="button"
                onClick={() => setMessages([])}
                disabled={loading}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:text-white disabled:opacity-50"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                Clear
              </button>
            </div>

            <div ref={scrollRef} className="max-h-[45vh] space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <p
                      className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-500 px-3.5 py-2 text-sm text-white"
                      data-role="user"
                    >
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border ${
                        m.error
                          ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                          : "border-zinc-700 bg-zinc-800 text-zinc-300"
                      }`}
                      aria-hidden="true"
                    >
                      {m.error ? <TriangleAlert className="size-3.5" /> : <Compass className="size-3.5" />}
                    </span>
                    <p
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md border px-3.5 py-2 text-sm leading-relaxed ${
                        m.error ? "border-rose-500/20 bg-rose-500/5 text-rose-300" : "border-zinc-800 bg-zinc-950 text-zinc-200"
                      }`}
                      data-role={m.error ? "error" : "assistant"}
                    >
                      {m.content}
                    </p>
                  </div>
                ),
              )}
              {loading && (
                <div className="flex items-center gap-2.5" role="status">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  </span>
                  <span className="text-sm text-zinc-500">Thinking...</span>
                </div>
              )}
            </div>
          </section>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="copilot-input" className="sr-only">
            Ask the AI Copilot
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 p-2 pl-4 shadow-2xl shadow-black/50 backdrop-blur focus-within:border-zinc-600">
            <Compass className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
            <input
              id="copilot-input"
              type="text"
              value={question}
              maxLength={MAX_CHARS}
              autoComplete="off"
              disabled={loading}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Can I afford this? Ask about your cash flow or debt..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!question.trim() || loading}
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-zinc-950 transition-colors hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500"
              aria-label={loading ? "Sending question" : "Send question"}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUp className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-zinc-500">
            Guidance covers cash flow and debt only, not investments. Not financial advice.
          </p>
        </form>
      </div>
    </div>
  );
}
