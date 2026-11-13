"use client";

import { useState } from "react";
import { ArrowUp, Compass } from "lucide-react";

// UI only for now. Nothing is sent anywhere until the Copilot is wired up
// (that will go through a server route with server-side validation).
export function CopilotBar() {
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div id="copilot" className="sticky bottom-0 z-20 scroll-mt-20 px-4 pb-4 pt-8 sm:px-6 lg:px-8">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent"
        aria-hidden="true"
      />
      <form
        className="relative mx-auto max-w-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          setNotice("The Copilot isn't connected yet. Answers arrive in the next update.");
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
            maxLength={500}
            autoComplete="off"
            onChange={(e) => {
              setQuestion(e.target.value);
              setNotice(null);
            }}
            placeholder="Can I afford this? Ask about your cash flow or debt..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-zinc-950 transition-colors hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500"
            aria-label="Send question"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-zinc-500" role="status">
          {notice ?? "Guidance covers cash flow and debt only, not investments."}
        </p>
      </form>
    </div>
  );
}
