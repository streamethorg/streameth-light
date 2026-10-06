"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskEvent, AskSource } from "./ask";

/** "signin": the visitor isn't signed in; the UI shows a sign-in prompt. */
export type AskStatus = "idle" | "searching" | "answering" | "done" | "error" | "signin";

export interface AskState {
  status: AskStatus;
  /** The question being answered; "" when idle. */
  asked: string;
  searches: string[];
  sources: AskSource[];
  answer: string;
  error: string;
}

const IDLE: AskState = { status: "idle", asked: "", searches: [], sources: [], answer: "", error: "" };

/** Asks /api/ask and follows its NDJSON stream into state. `videoId`
 * scopes questions to one talk (its transcript first, then the archive).
 * A new question aborts the one in flight; so does unmounting. */
export function useAsk(videoId?: string) {
  const [state, setState] = useState<AskState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (q.length < 3) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ ...IDLE, status: "searching", asked: q });

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, videoId }),
          signal: controller.signal,
        });
        if (res.status === 401) {
          setState((s) => ({ ...s, status: "signin" }));
          return;
        }
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Something went wrong. Try again.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;
        while (!finished) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as AskEvent;
            if (event.type === "error") throw new Error(event.message);
            if (event.type === "done") finished = true;
            setState((s) => {
              switch (event.type) {
                case "search":
                  return { ...s, searches: [...s.searches, event.query] };
                case "sources":
                  return { ...s, sources: [...s.sources, ...event.sources] };
                case "discard":
                  return { ...s, answer: "", status: "searching" };
                case "text":
                  return { ...s, answer: s.answer + event.text, status: "answering" };
                default:
                  return s;
              }
            });
          }
        }
        setState((s) => ({ ...s, status: "done" }));
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Something went wrong. Try again.";
        setState((s) => ({ ...s, status: "error", error: message }));
      }
    },
    [videoId]
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  return { state, ask, clear };
}
