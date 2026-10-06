"use client";

import Link from "next/link";
import { useState } from "react";

/** The confirm / unsubscribe landing pages: explain, then one button that
 * runs the server action with the link's token. */
export default function DigestTokenAction({
  token,
  action,
  title,
  body,
  button,
  done,
}: {
  token: string;
  action: (token: string) => Promise<boolean>;
  title: string;
  body: string;
  button: string;
  done: string;
}) {
  const [state, setState] = useState<"idle" | "working" | "done" | "invalid" | "error">(token ? "idle" : "invalid");

  async function run() {
    setState("working");
    try {
      setState((await action(token)) ? "done" : "invalid");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-20">
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{title}</h1>
      {state === "done" ? (
        <p className="text-sm text-ink-dim">{done}</p>
      ) : state === "invalid" ? (
        <p className="text-sm text-ink-dim">This link isn&apos;t valid. It may have been mistyped or already replaced by a newer one.</p>
      ) : (
        <>
          <p className="text-sm text-ink-dim">{body}</p>
          <button
            type="button"
            onClick={run}
            disabled={state === "working"}
            className="w-fit rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {state === "working" ? "Working…" : button}
          </button>
          {state === "error" && <p className="text-sm text-error">Something went wrong. Try again.</p>}
        </>
      )}
      <Link href="/" className="text-sm font-medium text-ink-dim hover:text-accent">
        ← Back to StreamETH
      </Link>
    </div>
  );
}
