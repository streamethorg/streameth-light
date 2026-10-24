"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addEmbedAction, removeEmbedAction } from "@/app/add/actions";
import { matchMedia, mediaLabel, MAX_NOTE_LENGTH } from "@/lib/embedCore.mjs";

export interface EventOption {
  key: string;
  label: string;
}

export interface MyEmbed {
  id: string;
  title: string;
  label: string;
  url: string;
  eventName: string;
  eventHref: string | null;
  reporterName: string;
}

const INPUT =
  "h-11 w-full min-w-0 rounded-sm bg-panel-raised px-4 text-sm text-ink ring-1 ring-line placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent";

/** Paste a link into an event's feed: pick the byline and the event, paste,
 * optionally say why it matters. The link is recognised as you type. */
export function EmbedForm({
  reporters,
  events,
  initialEventKey,
}: {
  reporters: { slug: string; name: string }[];
  events: EventOption[];
  initialEventKey?: string;
}) {
  const initialEvent = events.find((e) => e.key === initialEventKey);
  const [reporterSlug, setReporterSlug] = useState(reporters[0]?.slug ?? "");
  const [eventText, setEventText] = useState(initialEvent?.label ?? "");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ title: string; eventUrl: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const event = events.find((e) => e.label === eventText);
  const match = url.trim() ? matchMedia(url) : null;
  const recognised = url.trim() ? (match ? mediaLabel(match.provider, match.variant) : null) : undefined;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdded(null);
    if (!event) {
      setError("Pick an event from the list.");
      return;
    }
    startTransition(async () => {
      const result = await addEmbedAction({ reporterSlug, eventKey: event.key, url, note });
      if (result.ok) {
        setAdded({ title: result.embed.title, eventUrl: result.embed.eventUrl });
        setUrl("");
        setNote("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-dim">Reporter</span>
          <select value={reporterSlug} onChange={(e) => setReporterSlug(e.target.value)} className={INPUT}>
            {reporters.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-dim">Event</span>
          <input
            value={eventText}
            onChange={(e) => setEventText(e.target.value)}
            list="add-events"
            required
            placeholder="Start typing an event"
            className={INPUT}
          />
          <datalist id="add-events">
            {events.map((e) => (
              <option key={e.key} value={e.label} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-3 text-[13px] font-medium text-ink-dim">
          Link
          {recognised !== undefined && (
            <span className={recognised ? "text-accent" : "text-error"}>{recognised ?? "Not a link we can add"}</span>
          )}
        </span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          inputMode="url"
          placeholder="https://youtu.be/…, https://x.com/…/status/…, any https page"
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-dim">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          placeholder="Why it matters, in a line"
          className="rounded-sm bg-panel-raised px-4 py-3 text-sm text-ink ring-1 ring-line placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      <button
        type="submit"
        disabled={pending || !match}
        className="h-11 w-fit rounded-sm bg-accent px-5 text-sm font-semibold text-accent-ink transition-colors hover:bg-stage disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to feed"}
      </button>
      {error && <p className="text-sm text-error">{error}</p>}
      {added && (
        <p className="rounded-lg bg-accent/5 px-3 py-2 text-sm text-ink ring-1 ring-accent/30">
          Added “{added.title}”.{" "}
          <Link href={added.eventUrl} className="font-medium text-accent hover:underline">
            See it in the feed
          </Link>
        </p>
      )}
    </form>
  );
}

/** What the user's reporters have added, each removable. */
export function MyEmbedList({ embeds }: { embeds: MyEmbed[] }) {
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (embeds.length === 0) return <p className="text-sm text-ink-faint">Nothing added yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-line">
        {embeds.map((e) => (
          <li key={e.id} className="flex items-start justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <a href={e.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium text-ink hover:text-accent">
                {e.title || e.url}
              </a>
              <p className="truncate text-[13px] text-ink-faint">
                {e.label} ·{" "}
                {e.eventHref ? (
                  <Link href={e.eventHref} className="hover:text-ink hover:underline">
                    {e.eventName}
                  </Link>
                ) : (
                  e.eventName
                )}{" "}
                · {e.reporterName}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setRemoving(e.id);
                startTransition(async () => {
                  const result = await removeEmbedAction(e.id);
                  if (!result.ok) setError(result.error ?? "Couldn't remove it.");
                  setRemoving(null);
                });
              }}
              className="shrink-0 text-[13px] text-ink-dim hover:text-error disabled:opacity-60"
            >
              {removing === e.id ? "Removing…" : "Remove"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
