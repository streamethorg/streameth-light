"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <p className="rounded-xl bg-accent/10 px-4 py-3 text-center text-sm text-ink-dim">
        Check <span className="font-semibold text-ink">{email}</span> for your sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email address"
        className="h-12 w-full rounded-xl bg-panel px-4 text-[15px] text-ink shadow-sm ring-1 ring-line placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="h-12 w-full rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-ink transition-colors hover:bg-stage disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send sign-in link"}
      </button>
      {status === "error" && (
        <p className="text-sm text-error">Couldn&apos;t send the link. Check the address and try again.</p>
      )}
    </form>
  );
}
