"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Weekly digest signup: email in, confirmation link out (nothing is
 * mailed until it's clicked). One form, shown in two places — the banner
 * above the top bar and the top bar's "Subscribe" popover. */
function DigestForm({ tone, autoFocus = false }: { tone: "banner" | "panel"; autoFocus?: boolean }) {
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

  const onBanner = tone === "banner";

  if (state === "sent") {
    return (
      <p className={`text-sm font-medium ${onBanner ? "text-white" : "text-ink"}`}>
        Check your inbox for a confirmation link.
      </p>
    );
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
          className={`h-8 min-w-0 flex-1 rounded-md px-3 text-sm focus:outline-none ${
            onBanner
              ? "border border-white/25 bg-white/10 text-white placeholder:text-white/60 focus:border-white/60 sm:w-56 sm:flex-none"
              : "border border-line bg-void text-ink placeholder:text-ink-faint focus:border-accent"
          }`}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className={`h-8 shrink-0 rounded-md px-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${
            onBanner ? "bg-white text-accent" : "bg-accent text-accent-ink"
          }`}
        >
          {state === "sending" ? "Sending…" : "Subscribe"}
        </button>
      </div>
      {state === "error" && <p className={`text-xs ${onBanner ? "text-white" : "text-error"}`}>{error}</p>}
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

/** The strip above the top bar: what the digest is, and the signup form.
 * Closable; the top bar's Subscribe button stays either way. */
export function DigestBanner() {
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => false);
  if (dismissed) return null;

  return (
    <div className="bg-accent text-white">
      <div className="mx-auto flex w-full max-w-[1760px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <p className="text-sm">
          <span className="font-semibold">New Ethereum talks, every Monday.</span>{" "}
          <span className="text-white/80">The week&apos;s conference uploads by event, in your inbox.</span>
        </p>
        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="w-full sm:w-auto">
            <DigestForm tone="banner" />
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/** The top bar's always-there "Subscribe" button, opening the signup in a
 * small popover. */
export function SubscribeButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Weekly email of new talks"
        className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors ${
          open ? "border-accent/40 text-accent" : "border-line text-ink hover:border-accent/40 hover:text-accent"
        }`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
          <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
          <path d="M3 6l7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">Subscribe</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Weekly email"
          className="absolute right-0 top-full z-50 mt-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl border border-line bg-panel p-4 shadow-lg"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-ink">New talks every Monday</p>
            <p className="text-sm text-ink-dim">The week&apos;s Ethereum conference uploads, grouped by event.</p>
          </div>
          <DigestForm tone="panel" autoFocus />
        </div>
      )}
    </div>
  );
}
