"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTED_PROMPTS = [
  "Am I overtraining this week?",
  "Was yesterday's run actually easy?",
  "How's my recovery looking?",
  "Did I hit my paces on my last planned workout?",
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsThinking(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const data: { role: "assistant"; content: string } = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong talking to the coach.");
    } finally {
      setIsThinking(false);
      scrollToBottom();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface shadow-card">
      <div ref={listRef} className="flex max-h-[60vh] min-h-[320px] flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted">
            Ask about recent workouts, training load, recovery, or how your plan compares to what you actually did.
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-accent/10 text-foreground"
                  : "bg-surface-2 text-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3.5 py-2.5">
              <ThinkingDots />
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
              {error}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setInput(prompt)}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-line p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your training..."
          rows={1}
          className="min-h-[42px] flex-1 resize-none rounded-md border border-line bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="submit"
          disabled={isThinking || !input.trim()}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1" aria-label="Coach is thinking" role="status">
      <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: "0ms" }} />
      <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: "150ms" }} />
      <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: "300ms" }} />
      <style jsx>{`
        .thinking-dot {
          animation: thinking-pulse 1.2s ease-in-out infinite;
        }
        @keyframes thinking-pulse {
          0%,
          80%,
          100% {
            opacity: 0.3;
            transform: scale(0.85);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .thinking-dot {
            animation: thinking-fade 1.6s ease-in-out infinite;
          }
          @keyframes thinking-fade {
            0%,
            100% {
              opacity: 0.35;
            }
            50% {
              opacity: 0.9;
            }
          }
        }
      `}</style>
    </span>
  );
}
