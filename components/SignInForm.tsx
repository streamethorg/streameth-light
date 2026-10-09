"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/account";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Supabase won't send another code to the same address sooner than this.
const RESEND_SECONDS = 60;

type Step = { kind: "email" } | { kind: "code"; email: string };

function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

function sendErrorMessage(error: AuthError): string {
  if (error.status === 429) return "Too many emails sent. Wait a minute and try again.";
  return "Couldn't send the email. Check the address and try again.";
}

const inputClass =
  "h-12 w-full rounded-xl bg-panel px-4 text-[15px] text-ink ring-1 ring-line outline-none transition-shadow placeholder:text-ink-faint focus:ring-2 focus:ring-accent";
const primaryClass =
  "flex h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-ink transition-colors hover:bg-stage disabled:opacity-60";

export default function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [supabase] = useState(() => createClient());
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("failed") === "1" ? "That sign-in link didn't work. Try again." : null
  );
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode(address: string): Promise<boolean> {
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: callbackUrl(next) },
    });
    if (sendError) {
      console.error("[signin] sending code failed:", sendError);
      setError(sendErrorMessage(sendError));
      return false;
    }
    setResendIn(RESEND_SECONDS);
    return true;
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    if (await sendCode(address)) {
      setCode("");
      setStep({ kind: "code", email: address });
    }
    setBusy(false);
  }

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (step.kind !== "code") return;
    const token = code.replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) {
      setError("Enter the code from the email.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: step.email, token, type: "email" });
    if (verifyError) {
      console.error("[signin] verifying code failed:", verifyError);
      setError(
        verifyError.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "That code is wrong or has expired. Check the email or send a new one."
      );
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function onResend() {
    if (step.kind !== "code" || resendIn > 0) return;
    setBusy(true);
    setError(null);
    await sendCode(step.email);
    setBusy(false);
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(next) },
    });
    // On success the browser is already navigating to Google.
    if (oauthError) {
      console.error("[signin] Google sign-in failed:", oauthError);
      setError("Couldn't reach Google. Try again.");
      setBusy(false);
    }
  }

  if (step.kind === "code") {
    return (
      <form onSubmit={onCodeSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <p className="text-center text-sm text-ink-dim">
          We sent a code to <span className="font-semibold text-ink">{step.email}</span>. Enter it
          below, or click the link in the email.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={10}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          aria-label="Sign-in code"
          className={`${inputClass} text-center font-mono tracking-[0.3em]`}
        />
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && <p className="text-center text-sm text-error">{error}</p>}
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setStep({ kind: "email" });
              setError(null);
            }}
            className="text-ink-faint transition-colors hover:text-ink"
          >
            Use a different email
          </button>
          <button
            type="button"
            onClick={onResend}
            disabled={busy || resendIn > 0}
            className="font-medium text-accent transition-opacity hover:underline disabled:text-ink-faint disabled:no-underline"
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-panel px-4 text-[15px] font-semibold text-ink ring-1 ring-line transition-colors hover:bg-panel-hover disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 01-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0012 24z" />
              <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 010-4.6V6.6h-4a12 12 0 000 10.8l4-3.1z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 001.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
            </svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      <form onSubmit={onEmailSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className={inputClass}
        />
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy ? "Sending…" : "Email me a sign-in code"}
        </button>
      </form>
      {error && <p className="text-center text-sm text-error">{error}</p>}
    </div>
  );
}
