import Link from "next/link";
import type { ReactNode } from "react";
import UnifiedVideoCard from "./UnifiedVideoCard";
import { ShortsRow } from "./ShortCard";
import StoryCard from "./StoryCard";
import {
  eventCoverage,
  formatEventDates,
  liveStreamFor,
  nowOnStage,
  statusLine,
  statusOf,
  upNext,
  type ScheduledSession,
  type SeasonEvent,
} from "@/lib/season";
import { listStoriesForEvents, visibleOn } from "@/lib/stories";

const STATUS_LABEL = { live: "Live", upcoming: "Coming up", recent: "Latest", past: "Latest" } as const;

export function StatusChip({ event, now }: { event: SeasonEvent; now: number }) {
  const status = statusOf(event, now);
  if (status === "live") {
    return (
      <span className="tabular inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-live">
        <span className="h-2 w-2 animate-pulse rounded-full bg-live" aria-hidden="true" />
        Live
      </span>
    );
  }
  return <span className="kicker">{STATUS_LABEL[status]}</span>;
}

/** "2:30 PM IST" in the event's own zone (UTC when unknown). */
export function sessionTime(ms: number, timeZone: string | null): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone ?? "UTC",
    timeZoneName: "short",
  });
}

export function ScheduleList({
  title,
  sessions,
  showTime,
  timeZone,
}: {
  title: string;
  sessions: ScheduledSession[];
  showTime: boolean;
  timeZone: string | null;
}) {
  if (sessions.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">{title}</h3>
      <ul className="flex flex-col">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-col gap-0.5 border-t border-line py-3">
            <p className="text-[13px] text-ink-faint">
              {showTime && (
                <>
                  <span className="tabular font-semibold text-ink">{sessionTime(s.start, timeZone)}</span>
                  <span aria-hidden="true"> · </span>
                </>
              )}
              <span className={showTime ? "text-ink-dim" : "font-medium text-ink"}>{s.room}</span>
            </p>
            <p className="break-words text-[16px] font-semibold leading-[1.35rem] text-ink">{s.title}</p>
            {s.speakers.length > 0 && <p className="truncate text-[13px] text-ink-dim">{s.speakers.join(", ")}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One event's coverage: status and dates, the stream when one is on air,
 * what's on stage, the latest report, and the newest Shorts, clips and
 * talks.
 * - `lead`: the front page's top slot when there's no story to lead with
 * - `summary`: a homepage "Live coverage" section
 * - `full`: the top of the event's coverage page */
export default async function LiveBlock({
  event,
  now,
  variant = "summary",
  aside,
}: {
  event: SeasonEvent;
  now: number;
  variant?: "lead" | "summary" | "full";
  /** Phones only: shown right after the header, ahead of the stream and
   * recordings (the homepage's on now / coming up list). */
  aside?: ReactNode;
}) {
  const status = statusOf(event, now);
  const lead = variant === "lead";
  const full = variant === "full";
  const coverage = eventCoverage(event, 200);
  const shorts = coverage.filter((v) => v.format === "short" && v.coverImage);
  const talks = coverage.filter((v) => v.format !== "short" && v.liveStatus !== "is_upcoming");
  const stream = liveStreamFor(event, now);
  const onStage = status === "live" ? nowOnStage(event, now) : [];
  const next = status === "live" || status === "upcoming" ? upNext(event, now, full ? 8 : 4) : [];
  const stories = (await listStoriesForEvents([event.key], 3)).filter((s) =>
    visibleOn(s.reporter?.trust, full ? "event" : "homepage")
  );
  const story = stories[0];
  const talkCount = lead ? 6 : full ? 8 : 4;

  const where = [formatEventDates(event), event.city, statusLine(event, now)].filter(Boolean).join(" · ");
  const title = event.href ? (
    <Link href={event.href} className="transition-colors hover:text-ink-dim">
      {event.name}
    </Link>
  ) : (
    event.name
  );

  return (
    <section className="flex min-w-0 flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink-faint">
            <StatusChip event={event} now={now} />
            {!full && event.channelName && event.channelName !== event.name && (
              <>
                <span aria-hidden="true" className="h-px w-6 bg-line-strong" />
                <span>{event.channelName}</span>
              </>
            )}
          </p>
          <h2
            className={`headline text-ink ${
              lead ? "text-[clamp(2.4rem,5vw,4.15rem)]" : full ? "text-[clamp(2rem,3.6vw,3rem)]" : "text-[34px]"
            }`}
          >
            {title}
          </h2>
          <p className={`dek text-ink-dim ${lead ? "text-[21px]" : "text-lg"}`}>{where}</p>
        </div>
        {event.href && (
          <Link
            href={event.href}
            className="inline-flex h-9 shrink-0 items-center rounded-sm border border-line-strong px-3.5 text-sm font-medium text-ink transition-colors hover:border-ink-faint"
          >
            {status === "live" ? "Follow live" : "Full coverage"} →
          </Link>
        )}
        {!event.href && event.website && (
          <a
            href={event.website}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-sm text-ink-faint transition-colors hover:text-ink"
          >
            Event site ↗
          </a>
        )}
      </div>

      {aside && <div className="lg:hidden">{aside}</div>}

      {stream && (
        <div className="flex flex-col gap-2">
          <div className="aspect-video w-full overflow-hidden rounded-sm bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${stream.id.slice("yt-".length)}?autoplay=0`}
              title={stream.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <p className="text-sm text-ink-dim">{stream.title}</p>
        </div>
      )}

      {(onStage.length > 0 || next.length > 0) && (
        <div
          className={`grid grid-cols-1 gap-8 ${
            onStage.length > 0 && next.length > 0 && !lead ? "md:grid-cols-2" : ""
          }`}
        >
          <ScheduleList
            title="On stage now"
            sessions={onStage.slice(0, full ? 12 : 4)}
            showTime={false}
            timeZone={event.timeZone}
          />
          <ScheduleList title="Up next" sessions={next} showTime timeZone={event.timeZone} />
        </div>
      )}

      {story && (
        <div className="border-t border-line pt-6">
          <StoryCard story={story} now={now} variant="stack" showCover={false} />
        </div>
      )}

      {status === "live" && !stream && coverage.length === 0 && (
        <p className="dek text-lg text-ink-dim">
          Happening now{event.city ? ` in ${event.city}` : ""}. Recordings appear here as they&apos;re published.
        </p>
      )}
      {status === "upcoming" && !story && next.length === 0 && event.description && (
        <p className="dek line-clamp-3 max-w-[60ch] text-lg leading-7 text-ink-dim">{event.description}</p>
      )}

      {shorts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">Shorts</h3>
          <ShortsRow videos={shorts} max={full ? 12 : 6} />
        </div>
      )}

      {talks.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
            {status === "live" ? "Just published" : "Latest recordings"}
            <span className="tabular ml-2 font-normal normal-case tracking-normal">{talks.length.toLocaleString()} so far</span>
          </h3>
          <div
            className={`grid grid-cols-1 gap-x-6 gap-y-10 min-[560px]:grid-cols-2 ${lead ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
          >
            {talks.slice(0, talkCount).map((v) => (
              <UnifiedVideoCard key={v.id} video={v} hideChannel eventName={event.name} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
