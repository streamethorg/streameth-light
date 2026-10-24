"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { reportMistake, type ReportResult } from "@/app/stories/actions";

/** A quiet link under a story that opens a short form: what's wrong. */
export default function ReportMistake({ storyId, storySlug }: { storyId: string; storySlug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok) {
    return <p className="text-sm text-ink-dim">Thanks — the report was sent.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit text-sm font-medium text-ink-dim underline-offset-4 hover:text-accent hover:underline"
      >
        Report a mistake
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => setResult(await reportMistake(storyId, reason)));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-line pt-4">
      <label htmlFor="report-reason" className="text-sm font-semibold text-ink">
        What&apos;s wrong in this story?
      </label>
      <textarea
        id="report-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={1000}
        required
        minLength={5}
        placeholder="E.g. the quote in paragraph 3 is attributed to the wrong speaker."
        className="rounded-sm border border-line-strong bg-void px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />
      {result && !result.ok && (
        <p className="text-sm text-error">
          {result.error}{" "}
          {result.signIn && (
            <Link href={`/signin?next=${encodeURIComponent(`/stories/${storySlug}`)}`} className="font-semibold underline">
              Sign in
            </Link>
          )}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || reason.trim().length < 5}
          className="rounded-sm bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-sm border border-line-strong px-3.5 py-2 text-sm font-medium text-ink hover:border-ink-faint"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
