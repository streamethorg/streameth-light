"use client";

import { useState, useSyncExternalStore } from "react";

/** Weekly digest signup: email in, confirmation link out (nothing is
 * mailed until it's clicked). One form, shown in two places — the strip
 * above the top bar (compact) and the footer. */
export function DigestForm({ tone, autoFocus = false }: { tone: "banner" | "panel"; autoFocus?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/digest/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Couldn't subscribe right now. Try again later.");
      }
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't subscribe right now. Try again later.");
      setState("error");
    }
  }

  const compact = tone === "banner";

  if (state === "sent") {
    return <p className="text-sm font-medium text-ink">Check your inbox for a confirmation link.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center gap-2">
        <input
          type="email"
          required
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
          placeholder="you@example.com"
          className={`min-w-0 flex-1 rounded-sm border border-line-strong bg-void px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none ${
            compact ? "h-8 sm:w-56 sm:flex-none" : "h-9"
          }`}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className={`shrink-0 rounded-sm bg-accent px-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50 ${
            compact ? "h-8" : "h-9"
          }`}
        >
          {state === "sending" ? "Sending…" : "Subscribe"}
        </button>
      </div>
      {state === "error" && <p className="text-xs text-error">{error}</p>}
    </form>
  );
}

const BANNER_KEY = "streameth:digest-banner-dismissed";
const BANNER_EVENT = "streameth:digest-banner-change";

// Dismissing the banner is a per-viewer preference in localStorage, read via
// useSyncExternalStore so the server renders it and the client hides it
// without a hydration mismatch.
function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeDismissed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(BANNER_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(BANNER_EVENT, onChange);
  };
}

function dismiss() {
  try {
    window.localStorage.setItem(BANNER_KEY, "1");
  } catch {
    // Storage unavailable: it hides for this page view only.
  }
  window.dispatchEvent(new Event(BANNER_EVENT));
}

/** The strip above the top bar: one quiet line saying what the digest is,
 * with the signup form beside it. Closable. On phones it shrinks to a
 * single link down to the footer's form, so it never pushes the page down
 * by more than a line. */
export function DigestBanner() {
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => false);
  if (dismissed) return null;

  return (
    <div className="border-b border-line bg-void">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-4 px-4 sm:px-8">
        <a
          href="#digest"
          className="flex h-10 flex-1 items-center text-sm font-medium text-accent hover:underline sm:hidden"
        >
          Get the Monday email →
        </a>
        <p className="hidden min-w-0 flex-1 truncate text-sm text-ink-dim sm:block">
          <span className="font-semibold text-ink">New Ethereum talks, every Monday.</span>{" "}
          <span className="hidden md:inline">The week&apos;s conference uploads by event, in your inbox.</span>
        </p>
        <div className="hidden py-1.5 sm:block">
          <DigestForm tone="banner" />
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-ink-faint hover:bg-panel-raised hover:text-ink"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
