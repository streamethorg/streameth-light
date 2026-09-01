import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VideoCard from "@/components/VideoCard";
import { listSpeakers, getSpeakerBySlug, getSpeakerSessions } from "@/lib/people";
import { getEventById } from "@/lib/data";
import { initials } from "@/lib/format";

export function generateStaticParams() {
  return listSpeakers().map((sp) => ({ speaker: sp.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ speaker: string }>;
}): Promise<Metadata> {
  const { speaker: slug } = await params;
  const speaker = getSpeakerBySlug(slug);
  if (!speaker) return {};
  return {
    title: `${speaker.name} — StreamETH Light`,
    description: speaker.bio?.slice(0, 200),
  };
}

export default async function SpeakerPage({
  params,
}: {
  params: Promise<{ speaker: string }>;
}) {
  const { speaker: slug } = await params;
  const speaker = getSpeakerBySlug(slug);
  if (!speaker) notFound();

  const sessions = getSpeakerSessions(speaker);
  const twitterHandle = speaker.twitter?.trim().replace(/^@/, "");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <Link
        href="/speakers"
        className="w-fit font-mono text-xs uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-dim"
      >
        ← All speakers
      </Link>

      <div className="flex items-center gap-5">
        {speaker.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={speaker.photo}
            alt=""
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-panel-raised font-display text-xl font-bold text-ink-dim">
            {initials(speaker.name)}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            {speaker.name}
          </h1>
          {speaker.company && (
            <p className="font-mono text-xs text-ink-faint">
              {speaker.company}
            </p>
          )}
          {twitterHandle && (
            <a
              href={`https://x.com/${twitterHandle}`}
              target="_blank"
              rel="noreferrer"
              className="w-fit font-mono text-xs text-ink-dim transition-colors hover:text-accent"
            >
              @{twitterHandle} ↗
            </a>
          )}
        </div>
      </div>

      {speaker.bio && (
        <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink-dim">
          {speaker.bio}
        </p>
      )}

      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">
          Talks
        </h2>
        <span className="font-mono text-xs tabular text-ink-faint">
          {String(sessions.length).padStart(2, "0")} total
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sessions.map((s) => (
          <VideoCard key={s._id} session={s} event={getEventById(s.eventId)} />
        ))}
      </div>
    </div>
  );
}
