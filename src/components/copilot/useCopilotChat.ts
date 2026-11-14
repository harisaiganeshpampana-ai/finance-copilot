"use client";

import { useCallback, useRef, useState } from "react";
import { useCurrency } from "@/components/currency/currency-store";

export type ChatMessage = { id: number; role: "user" | "assistant"; content: string; error?: boolean };

export const MAX_QUESTION_CHARS = 500;
const HISTORY_TURNS = 10;
const GENERIC_ERROR = "The Copilot couldn't answer right now. Please try again.";

/**
 * Chat state + sending logic for the AI Copilot.
 * The browser only sends the question, recent turns and the display currency to our
 * own /api/chat route. API keys and the financial data stay on the server.
 */
export function useCopilotChat() {
  const { currency } = useCurrency();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const nextId = useRef(1);
  const busy = useRef(false);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, MAX_QUESTION_CHARS);
      if (!text || busy.current) return;
      busy.current = true;

      const history = messages
        .filter((m) => !m.error)
        .slice(-HISTORY_TURNS)
        .map(({ role, content }) => ({ role, content }));

      setMessages((m) => [...m, { id: nextId.current++, role: "user", content: text }]);
      setLoading(true);

      let reply: ChatMessage;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history, currency }),
        });
        const data: { reply?: unknown; error?: unknown } = await res.json().catch(() => ({}));
        reply =
          res.ok && typeof data.reply === "string"
            ? { id: nextId.current++, role: "assistant", content: data.reply }
            : {
                id: nextId.current++,
                role: "assistant",
                content: typeof data.error === "string" ? data.error : GENERIC_ERROR,
                error: true,
              };
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
      busy.current = false;
    },
    [messages, currency],
  );

  const clear = useCallback(() => {
    if (!busy.current) setMessages([]);
  }, []);

  return { messages, loading, send, clear };
}
