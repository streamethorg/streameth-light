import Link from "next/link";
import type { ReactNode } from "react";
import TrackedEventRow from "./TrackedEventRow";
import ShortCard from "./ShortCard";
import CoverImage from "./CoverImage";
import Avatar from "./Avatar";
import EventNowPlaying, { EventAsk, NowPlayingAsk } from "./EventNowPlaying";
import { sessionTime } from "./LiveBlock";
import { STORY_KIND_LABELS } from "./StoryCard";
import { BackIcon, RssIcon } from "./NavIcons";
import {
  eventCoverage,
  eventSpeakers,
  formatEventDates,
  getSchedule,
  liveStreamFor,
  nowOnStage,
  previousEdition,
  scheduleByDay,
  sideEventsFor,
  statusLine,
  statusOf,
  upNext,
  youtubeChannelId,
  type ScheduledSession,
  type SeasonEvent,
} from "@/lib/season";
import { eventFeed, type FeedItem } from "@/lib/eventFeed";
import { findSpeakerSlugForName } from "@/lib/people";
import { getVideoById } from "@/lib/videoDb";
import { formatTimecode, withoutEventSuffix } from "@/lib/format";
import type { Story } from "@/lib/stories";
import type { UnifiedVideo, VideoFormat } from "@/lib/videoDb";

export type EventTab = "live" | "info" | "speakers" | "videos" | "livestream";
export type VideoLength = "all" | "long" | "short";

const DAY = 24 * 60 * 60 * 1000;

const TABS: { tab: EventTab; label: string }[] = [
  { tab: "live", label: "Live" },
  { tab: "info", label: "Info" },
  { tab: "speakers", label: "Speakers" },
  { tab: "videos", label: "Videos" },
  { tab: "livestream", label: "Livestream" },
];

export function parseEventTab(raw: string | string[] | undefined): EventTab {
  return TABS.some((t) => t.tab === raw) ? (raw as EventTab) : "live";
}

export function parseVideoLength(raw: string | string[] | undefined): VideoLength {
  return raw === "long" || raw === "short" ? raw : "all";
}

/** A tab's label. The feed tab reads "Live" only while the event is on;
 * before and after, it's the event's coverage. (Its URL stays ?tab=live.) */
function tabLabel(tab: EventTab, event: SeasonEvent, now: number): string {
  if (tab === "live" && statusOf(event, now) !== "live") return "Coverage";
  return TABS.find((t) => t.tab === tab)?.label ?? "Coverage";
}

/** A tab of the event page. `keep` is the video open at the top, carried
 * along so moving between tabs doesn't close it. */
function tabHref(event: SeasonEvent, tab: EventTab, extra = "", keep?: string): string {
  const params = `${extra}${keep && !extra.includes("&v=") ? `&v=${encodeURIComponent(keep)}` : ""}`;
  const base = event.href ?? "";
  if (tab === "live" && !params) return base;
  return `${base}?tab=${tab}${params}`;
}

/** The event page with a video playing at the top of the tab: videos open
 * in place rather than on a separate watch page. */
function playHref(event: SeasonEvent, tab: EventTab, video: UnifiedVideo, extra = ""): string {
  return tabHref(event, tab, `${extra}&v=${encodeURIComponent(video.id)}`);
}

/** What the Ask panel needs to search an event's talks. */
function askScopeOf(event: SeasonEvent) {
  return {
    key: event.key,
    name: event.name,
    transcribedTalks: eventCoverage(event, 1000).filter((v) => v.hasTranscript).length,
  };
}

/** "2:30 PM", the event's local time without the zone suffix. */
function localTime(ms: number, timeZone: string | null): string {
  return sessionTime(ms, timeZone).replace(/\s*(GMT|UTC)[+-]?[\d:]*$|\s+[A-Z]{2,5}$/, "");
}

/** "Mumbai, India", or just "Singapore" when city and country match. */
function placeOf(event: SeasonEvent): string {
  return [...new Set([event.city, event.country].filter(Boolean))].join(", ");
}

/** A talk title without the " - <event>" suffix channels append: on the
 * event's own page it only repeats the headline. */
function cleanTitle(title: string, event: SeasonEvent): string {
  return withoutEventSuffix(title, event.name, event.channelName);
}

/** "Alex Pruden - Crypto-Agility…" under Alex Pruden's name: just the
 * talk's own title. */
function talkTitleFor(name: string, title: string): string {
  const dash = title.search(/\s[-–—|]\s/);
  return dash > 0 && title.startsWith(name) ? title.slice(dash + 3).trim() || title : title;
}

// Small uppercase labels: section headings, day headers, kickers.
const LABEL = "text-[13px] font-semibold uppercase tracking-wider text-ink-dim";
const RAIL_SECTION = "flex flex-col gap-3 border-t border-line pt-4";

/** One event's page, /<channel>/<event>: the event and its sections on the
 * left, the section's content in the middle column, and Ask, what's on
 * stage, what's next and the speakers on the right. */
export default async function EventCoverage({
  event,
  now,
  tab,
  length,
  day,
  playing,
}: {
  event: SeasonEvent;
  now: number;
  tab: EventTab;
  length: VideoLength;
  day: string | undefined;
  /** ?v=<video id>: play this video at the top of the tab. */
  playing: string | undefined;
}) {
  const label = tabLabel(tab, event, now);
  const nowPlaying = playing ? getVideoById(playing) : undefined;
  return (
    <div className="grid w-full grid-cols-1 px-0 sm:px-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-8 xl:grid-cols-[250px_minmax(0,1fr)_340px]">
      <Sidebar event={event} now={now} tab={tab} playing={nowPlaying?.id} />

      <main className="min-w-0 border-line lg:border-x">
        {/* The column's heading; on phones the tab strip right above says it. */}
        <div className="sticky top-16 z-10 hidden items-baseline lg:flex justify-between gap-4 border-b border-line bg-void/95 px-4 py-3 backdrop-blur">
          <h2 className="shrink-0 text-[13px] font-semibold uppercase tracking-wider text-ink">{label}</h2>
          <p className="truncate text-[13px] text-ink-faint">{event.name}</p>
        </div>
        {nowPlaying && (
          <EventNowPlaying
            video={nowPlaying}
            event={askScopeOf(event)}
            closeHref={tabHref(event, tab, tab === "videos" && length !== "all" ? `&length=${length}` : "")}
          />
        )}
        {tab === "live" && <LiveTab event={event} now={now} />}
        {tab === "info" && <InfoTab event={event} day={day} playing={nowPlaying?.id} />}
        {tab === "speakers" && <SpeakersTab event={event} />}
        {tab === "videos" && <VideosTab event={event} length={length} playing={nowPlaying?.id} />}
        {tab === "livestream" && <LivestreamTab event={event} now={now} />}
      </main>

      <RightRail event={event} now={now} nowPlaying={nowPlaying} />
    </div>
  );
}

// ------------------------------------------------------------------ Sidebar

/** Live: a red dot and LIVE, then the day. Otherwise the plain status line
 * ("Starts in 10 days", "Ended 16 days ago"). */
function EventStatus({ event, now }: { event: SeasonEvent; now: number }) {
  if (statusOf(event, now) === "live") {
    return (
      <p className="tabular flex items-center gap-2 text-sm text-ink-dim">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-live">
          <span className="h-2 w-2 animate-pulse rounded-full bg-live" aria-hidden="true" />
          Live
        </span>
        {statusLine(event, now)}
      </p>
    );
  }
  return <p className="tabular text-sm text-ink-dim">{statusLine(event, now)}</p>;
}

function Sidebar({ event, now, tab, playing }: { event: SeasonEvent; now: number; tab: EventTab; playing?: string }) {
  const live = statusOf(event, now) === "live";
  return (
    <aside className="border-b border-line px-4 pt-4 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-b-0 lg:px-3 lg:pb-3 lg:pt-6">
      <div className="flex flex-col gap-4 lg:gap-6">
        {event.channelHref && event.channelName && (
          <Link
            href={event.channelHref}
            className="flex w-fit items-center gap-1 text-[13px] font-medium text-ink-dim transition-colors hover:text-ink"
          >
            <BackIcon className="h-4 w-4" />
            {event.channelName}
          </Link>
        )}

        <div className="flex min-w-0 flex-col gap-2 lg:px-1">
          {event.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.imageUrl}
              alt=""
              className="mb-1 aspect-video w-28 rounded-sm border border-line bg-panel-raised object-cover"
            />
          )}
          <h1 className="headline break-words text-[30px] text-ink lg:text-[26px]">{event.name}</h1>
          <p className="tabular text-sm text-ink-dim">
            {[formatEventDates(event), event.city].filter(Boolean).join(" · ")}
          </p>
          <EventStatus event={event} now={now} />
        </div>

        <nav
          aria-label="Event sections"
          className="-mx-4 flex gap-6 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0"
        >
          {TABS.map(({ tab: t }) => {
            const active = t === tab;
            return (
              <Link
                key={t}
                href={tabHref(event, t, "", playing)}
                // Switching tabs keeps your place (and the open video).
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`relative flex shrink-0 items-center gap-2 py-3 text-[15px] transition-colors lg:py-1.5 lg:pl-4 ${
                  active ? "font-semibold text-ink" : "font-medium text-ink-dim hover:text-ink"
                }`}
              >
                {active && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-accent lg:inset-x-auto lg:inset-y-1.5 lg:left-0 lg:h-auto lg:w-0.5"
                    aria-hidden="true"
                  />
                )}
                {tabLabel(t, event, now)}
                {t === "livestream" && live && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-live" aria-label="on air" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden flex-col items-start gap-3 lg:flex lg:px-1">
          {event.website && (
            <a
              href={event.website}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center rounded-sm border border-line-strong px-3.5 text-sm font-medium text-ink transition-colors hover:border-ink-faint"
            >
              Event site ↗
            </a>
          )}
          {event.href && (
            <a
              href={`${event.href}/feed.xml`}
              className="flex items-center gap-1.5 text-sm text-accent hover:underline"
              title="Follow this event in any RSS reader"
            >
              <RssIcon className="h-4 w-4" />
              RSS feed
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ Right rail

function RightRail({ event, now, nowPlaying }: { event: SeasonEvent; now: number; nowPlaying?: UnifiedVideo }) {
  const status = statusOf(event, now);
  const onStage = status === "live" ? nowOnStage(event, now) : [];
  const next = status === "live" || status === "upcoming" ? upNext(event, now, 5) : [];
  const speakers = eventSpeakers(event).slice(0, 6);

  return (
    <aside className="hidden min-w-0 flex-col gap-6 py-5 pl-6 xl:flex">
      {nowPlaying ? (
        <NowPlayingAsk video={nowPlaying} event={askScopeOf(event)} />
      ) : (
        <EventAsk eventKey={event.key} eventName={event.name} transcribedTalks={askScopeOf(event).transcribedTalks} />
      )}
      {onStage.length > 0 && (
        <section className={RAIL_SECTION}>
          <h2 className={`${LABEL} flex items-center gap-2`}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-live" aria-hidden="true" />
            On stage now
          </h2>
          <RailSessions sessions={onStage.slice(0, 6)} event={event} showTime={false} />
        </section>
      )}
      {next.length > 0 && (
        <section className={RAIL_SECTION}>
          <h2 className={LABEL}>Up next</h2>
          <RailSessions sessions={next} event={event} showTime />
          <Link href={tabHref(event, "info", "", nowPlaying?.id)} scroll={false} className="text-sm text-accent hover:underline">
            Full agenda
          </Link>
        </section>
      )}
      {speakers.length > 0 && (
        <section className={RAIL_SECTION}>
          <h2 className={LABEL}>Speakers</h2>
          <ul className="flex flex-col">
            {speakers.map((sp) => {
              // Their profile when they have one; else their talk here; else
              // the event's speaker list.
              const slug = findSpeakerSlugForName(sp.name);
              const href = slug
                ? `/speakers/${slug}`
                : sp.videos[0]
                  ? playHref(event, "speakers", sp.videos[0])
                  : tabHref(event, "speakers", "", nowPlaying?.id);
              // What they're here for: their slot, their talk, or how many.
              const about =
                sp.sessions[0]?.title ??
                (sp.videos.length > 1
                  ? `${sp.videos.length} recordings`
                  : sp.videos[0]
                    ? talkTitleFor(sp.name, cleanTitle(sp.videos[0].title, event))
                    : null);
              return (
                <li key={sp.name}>
                  <Link href={href} className="group flex items-center gap-3 py-2">
                    <Avatar name={sp.name} photo={sp.avatar} className="h-9 w-9 text-xs" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink group-hover:text-accent">{sp.name}</p>
                      {about && <p className="truncate text-[13px] text-ink-dim">{about}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href={tabHref(event, "speakers", "", nowPlaying?.id)} scroll={false} className="text-sm text-accent hover:underline">
            All speakers
          </Link>
        </section>
      )}
    </aside>
  );
}

/** Sessions in the rail. With times, a departures board: the time in a
 * fixed column, then what and where. */
function RailSessions({ sessions, event, showTime }: { sessions: ScheduledSession[]; event: SeasonEvent; showTime: boolean }) {
  return (
    <ol className="flex flex-col">
      {sessions.map((s) => (
        <li
          key={s.id}
          className={`border-t border-line py-2.5 first:border-t-0 first:pt-0 ${
            showTime ? "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3" : "flex flex-col gap-0.5"
          }`}
        >
          {showTime ? (
            <span className="tabular pt-px text-[13px] font-semibold text-ink">{localTime(s.start, event.timeZone)}</span>
          ) : (
            <span className="truncate text-[13px] text-ink-dim">{s.room}</span>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-semibold leading-5 text-ink">{s.title}</p>
            <p className="truncate text-[13px] text-ink-dim">
              {[showTime ? s.room : null, s.speakers.join(", ")].filter(Boolean).join(" · ")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ Feed

const FORMAT_LABEL: Record<VideoFormat, string | null> = {
  talk: null,
  clip: "Clip",
  short: "Short",
  stream: "Stream",
};

/** A recording in a list: a 16:9 cover, the title, who's speaking and how
 * long it runs. A row with a small cover on phones, a card from sm up. */
function VideoItem({ video, href, event }: { video: UnifiedVideo; href: string; event: SeasonEvent }) {
  const title = cleanTitle(video.title, event);
  const meta = [
    FORMAT_LABEL[video.format],
    video.durationSeconds !== null ? formatTimecode(video.durationSeconds) : null,
  ].filter(Boolean);
  return (
    <Link href={href} className="group grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 sm:flex sm:flex-col sm:gap-2.5">
      <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-panel-raised">
        <CoverImage src={video.coverImage} label={title} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="line-clamp-3 text-[15px] font-semibold leading-5 text-ink transition-colors group-hover:text-ink-dim sm:line-clamp-2">
          {title}
        </h3>
        {video.speakers.length > 0 && <p className="line-clamp-1 text-[13px] text-ink-dim">{video.speakers.join(", ")}</p>}
        {meta.length > 0 && <p className="tabular text-[13px] text-ink-faint">{meta.join(" · ")}</p>}
      </div>
    </Link>
  );
}

const VIDEO_GRID = "grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2 sm:gap-y-7 md:grid-cols-3";

/** The first `max` items, the rest behind a "Show all N" that opens in
 * place. */
function Expandable({ items, max, className }: { items: ReactNode[]; max: number; className: string }) {
  if (items.length <= max) return <div className={className}>{items}</div>;
  return (
    <div className="flex flex-col gap-5">
      <div className={className}>{items.slice(0, max)}</div>
      <details className="group flex flex-col">
        <summary className="w-fit cursor-pointer list-none text-sm text-accent hover:underline group-open:hidden [&::-webkit-details-marker]:hidden">
          Show all {items.length}
        </summary>
        <div className={className}>{items.slice(max)}</div>
      </details>
    </div>
  );
}

function StoryItem({ story }: { story: Story }) {
  const cover = story.sources.find((s) => s.coverImage)?.coverImage ?? null;
  const href = `/stories/${story.slug}`;
  return (
    <Link href={href} className="group grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-dim">
          {STORY_KIND_LABELS[story.kind]}
          {story.reporter && <span className="font-normal normal-case tracking-normal text-ink-faint"> · by {story.reporter.name}</span>}
        </p>
        <h3 className="text-[20px] font-semibold leading-[1.6rem] tracking-[-0.01em] text-ink transition-colors group-hover:text-ink-dim">
          {story.headline}
        </h3>
        <p className="line-clamp-3 text-[15px] leading-6 text-ink-dim">{story.standfirst}</p>
        <p className="tabular text-[13px] text-ink-faint">
          {story.sources.length} {story.sources.length === 1 ? "talk" : "talks"} cited
        </p>
      </div>
      {cover && (
        <div className="relative hidden aspect-video overflow-hidden rounded-sm bg-panel-raised sm:block">
          <CoverImage src={cover} label={story.headline} />
        </div>
      )}
    </Link>
  );
}

interface FeedDay {
  key: string;
  stories: Story[];
  videos: UnifiedVideo[];
  sessions: ScheduledSession[];
}

/** "2026-10-17" in the event's zone; uploads known only by day are stored
 * as UTC midnight, so they're read in UTC. */
function dayKeyOf(at: number, timeZone: string): string {
  return new Date(at).toLocaleDateString("en-CA", { timeZone });
}

/** The feed, newest day first: each day's stories, recordings and sessions. */
function feedDays(feed: FeedItem[], event: SeasonEvent): FeedDay[] {
  const zone = event.timeZone ?? "UTC";
  const days = new Map<string, FeedDay>();
  for (const item of feed) {
    const key = dayKeyOf(item.at, item.kind === "video" && item.dayOnly ? "UTC" : zone);
    let day = days.get(key);
    if (!day) {
      day = { key, stories: [], videos: [], sessions: [] };
      days.set(key, day);
    }
    if (item.kind === "story") day.stories.push(item.story);
    else if (item.kind === "video") day.videos.push(item.video);
    else day.sessions.push(item.session);
  }
  return [...days.values()];
}

/** "Today · Day 2 · Oct 8", "Day 1 · Oct 7", "Oct 17", "Dec 25, 2025". */
function dayLabel(key: string, event: SeasonEvent, now: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  const sameYear = date.getUTCFullYear() === new Date(now).getUTCFullYear();
  const parts = [
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" }),
  ];
  // Archive events' dates come from their uploads, so their days aren't
  // the event's days.
  if (!event.videoIds && event.start !== event.end && key >= event.start && key <= event.end) {
    const n = Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${event.start}T00:00:00Z`)) / DAY) + 1;
    parts.unshift(`Day ${n}`);
  }
  if (key === dayKeyOf(now, event.timeZone ?? "UTC")) parts.unshift("Today");
  return parts.join(" · ");
}

/** A small uppercase label with a hairline running to the column's edge. */
function RuleLabel({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h2" | "h3" }) {
  return (
    <Tag className={`tabular flex items-center gap-3 ${LABEL}`}>
      <span className="shrink-0">{children}</span>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
    </Tag>
  );
}

function DaySection({ day, event, now }: { day: FeedDay; event: SeasonEvent; now: number }) {
  return (
    <section className="flex flex-col gap-6 px-4 pb-4 pt-6">
      <RuleLabel>{dayLabel(day.key, event, now)}</RuleLabel>
      {day.stories.length > 0 && (
        <div className="flex flex-col gap-6">
          {day.stories.map((story) => (
            <StoryItem key={story.id} story={story} />
          ))}
        </div>
      )}
      {day.videos.length > 0 && (
        <Expandable
          max={6}
          className={VIDEO_GRID}
          items={day.videos.map((v) => (
            <VideoItem key={v.id} video={v} href={playHref(event, "live", v)} event={event} />
          ))}
        />
      )}
      {day.sessions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-faint">On stage</h3>
          <Expandable
            max={8}
            className="flex flex-col"
            items={day.sessions.map((s) => (
              <div key={s.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 border-t border-line py-2.5">
                <span className="tabular pt-px text-[13px] font-semibold text-ink">{localTime(s.start, event.timeZone)}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[15px] font-semibold leading-5 text-ink">{s.title}</p>
                  <p className="text-[13px] text-ink-dim">{[s.room, s.speakers.join(", ")].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
            ))}
          />
        </div>
      )}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-[15px] text-ink-dim">{children}</p>;
}

// ------------------------------------------------------------------ Live

async function LiveTab({ event, now }: { event: SeasonEvent; now: number }) {
  const status = statusOf(event, now);
  const stream = liveStreamFor(event, now);
  const feed = await eventFeed(event, now);

  if (status === "upcoming" && feed.length === 0) return <UpcomingFeed event={event} now={now} />;

  return (
    <>
      {stream && (
        <section className="flex flex-col gap-3 px-4 pb-2 pt-6">
          <p className="flex items-center gap-2 text-[13px] text-ink-dim">
            <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-live">
              <span className="h-2 w-2 animate-pulse rounded-full bg-live" aria-hidden="true" />
              Live
            </span>
            {event.channelName ?? event.name}
          </p>
          <div className="aspect-video w-full overflow-hidden rounded-sm bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${stream.id.slice("yt-".length)}`}
              title={stream.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <p className="text-[17px] font-semibold leading-snug text-ink">{cleanTitle(stream.title, event)}</p>
        </section>
      )}
      {feed.length === 0 ? (
        <Empty>Nothing here yet. Talks, recordings and stories show up here as they happen.</Empty>
      ) : (
        feedDays(feed, event).map((d) => <DaySection key={d.key} day={d} event={event} now={now} />)
      )}
    </>
  );
}

/** Before an event starts: a pinned countdown, then the last edition's
 * coverage so the page isn't empty. */
async function UpcomingFeed({ event, now }: { event: SeasonEvent; now: number }) {
  const days = Math.max(1, Math.ceil((event.from - now) / DAY));
  const last = previousEdition(event);
  const lastFeed = last ? await eventFeed(last, now, 40) : [];

  return (
    <>
      <section className="flex flex-col gap-3 border-b border-line px-4 py-6" aria-label="Countdown">
        <p className={LABEL}>Starts in</p>
        <p className="flex items-baseline gap-3">
          <span className="tabular text-[64px] font-semibold leading-none tracking-[-0.04em] text-ink">{days}</span>
          <span className="text-xl font-semibold text-ink">{days === 1 ? "day" : "days"}</span>
        </p>
        <p className="tabular text-[15px] text-ink-dim">
          {[formatEventDates(event), placeOf(event)].filter(Boolean).join(" · ")}
        </p>
        <p className="max-w-[60ch] text-[15px] leading-6 text-ink-dim">
          Live coverage starts here{event.city ? ` from ${event.city}` : ""}: talks as they go on stage, the livestream, every
          recording as it&apos;s uploaded, and AI-written reporting on what was said.
        </p>
      </section>

      {last && lastFeed.length > 0 && (
        <>
          <p className="px-4 pt-6 text-[15px] text-ink-dim">
            From the last edition,{" "}
            {last.href ? (
              <Link href={last.href} className="font-semibold text-accent hover:underline">
                {last.name}
              </Link>
            ) : (
              <span className="font-semibold text-ink">{last.name}</span>
            )}
          </p>
          {feedDays(lastFeed, last).map((d) => (
            <DaySection key={d.key} day={d} event={last} now={now} />
          ))}
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Info

const CHIP = "flex h-8 shrink-0 items-center rounded-sm border px-3 text-[13px] font-medium transition-colors";
const CHIP_ON = "border-ink bg-ink text-void";
const CHIP_OFF = "border-line-strong text-ink-dim hover:text-ink";

function InfoTab({ event, day, playing }: { event: SeasonEvent; day: string | undefined; playing?: string }) {
  const schedule = getSchedule(event);
  const days = scheduleByDay(event);
  const selected = days.find((d) => d.label === day) ?? days[0];
  const sideEvents = sideEventsFor(event).filter((e) => (e.startTime ?? "") >= event.start.slice(0, 7));

  return (
    <>
      <section className="flex flex-col gap-3 border-b border-line px-4 py-5">
        <p className="max-w-[68ch] whitespace-pre-line text-[15px] leading-6 text-ink">
          {event.description ?? `No description published for ${event.name} yet.`}
        </p>
        <p className="tabular flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-dim">
          <span>{formatEventDates(event)}</span>
          {(event.city || event.country) && <span>{placeOf(event)}</span>}
          {schedule && (
            <span>
              {schedule.sessions.length} sessions · {schedule.rooms.length} stages
            </span>
          )}
          {event.website && (
            <a href={event.website} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              {event.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
        </p>
      </section>

      {selected ? (
        <section>
          <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2.5 [scrollbar-width:none]">
            {days.map((d) => (
              <Link
                key={d.label}
                href={tabHref(event, "info", `&day=${encodeURIComponent(d.label)}`, playing)}
                scroll={false}
                aria-current={d === selected ? "page" : undefined}
                className={`${CHIP} ${d === selected ? CHIP_ON : CHIP_OFF}`}
              >
                {d.label}
              </Link>
            ))}
          </div>
          <ol>
            {selected.sessions.map((s) => (
              <li key={s.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 border-b border-line px-4 py-3">
                <span className="tabular pt-0.5 text-[13px] font-semibold text-ink">{localTime(s.start, event.timeZone)}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[13px] text-ink-dim">{[s.room, s.type].filter(Boolean).join(" · ")}</p>
                  <p className="text-[15px] font-semibold leading-5 text-ink">{s.title}</p>
                  {s.speakers.length > 0 && <p className="text-[13px] text-ink-dim">{s.speakers.join(", ")}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <Empty>The talk-by-talk agenda isn&apos;t published for {event.name}.</Empty>
      )}

      {sideEvents.length > 0 && (
        <section className="flex flex-col">
          <h2 className={`border-b border-line px-4 pb-3 pt-6 ${LABEL}`}>Side events</h2>
          {sideEvents.map((e) => (
            <TrackedEventRow key={e.id} event={e} />
          ))}
        </section>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Speakers

function SpeakersTab({ event }: { event: SeasonEvent }) {
  const speakers = eventSpeakers(event);
  if (speakers.length === 0) {
    return <Empty>No speakers announced yet. They show up here once the program or recordings are out.</Empty>;
  }
  return (
    <ul>
      {speakers.map((sp) => {
        const slug = findSpeakerSlugForName(sp.name);
        return (
          <li key={sp.name} className="flex gap-3 border-b border-line px-4 py-4">
            <Avatar name={sp.name} photo={sp.avatar} className="h-10 w-10 text-xs" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {slug ? (
                    <Link href={`/speakers/${slug}`} className="block truncate text-[15px] font-semibold text-ink hover:text-accent">
                      {sp.name}
                    </Link>
                  ) : (
                    <p className="truncate text-[15px] font-semibold text-ink">{sp.name}</p>
                  )}
                  {sp.twitter && (
                    <a
                      href={`https://x.com/${sp.twitter}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] text-ink-faint hover:text-ink"
                    >
                      @{sp.twitter}
                    </a>
                  )}
                </div>
                {sp.videos.length > 0 && (
                  <Link
                    href={playHref(event, "speakers", sp.videos[0])}
                    className="flex h-8 shrink-0 items-center rounded-sm border border-line-strong px-3 text-[13px] font-medium text-ink transition-colors hover:border-ink-faint"
                  >
                    Watch
                  </Link>
                )}
              </div>
              {sp.bio && <p className="line-clamp-2 text-[15px] leading-6 text-ink-dim">{sp.bio}</p>}
              {sp.sessions.map((s) => (
                <p key={s.id} className="text-[13px] text-ink-dim">
                  <span className="tabular font-semibold text-ink">{sessionTime(s.start, event.timeZone)}</span> · {s.room} · {s.title}
                </p>
              ))}
              {sp.sessions.length === 0 &&
                sp.videos.map((v) => (
                  <Link key={v.id} href={playHref(event, "speakers", v)} className="text-[13px] text-ink-dim hover:text-accent">
                    {cleanTitle(v.title, event)}
                  </Link>
                ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------ Videos

function VideosTab({ event, length, playing }: { event: SeasonEvent; length: VideoLength; playing?: string }) {
  const coverage = eventCoverage(event, 1000).filter((v) => v.liveStatus !== "is_upcoming");
  // Long form: full talks and stream recordings. Short form: clips and Shorts.
  const long = coverage.filter((v) => v.format === "talk" || v.format === "stream");
  const clips = coverage.filter((v) => v.format === "clip");
  const shorts = coverage.filter((v) => v.format === "short" && v.coverImage);
  const filters: { value: VideoLength; label: string; count: number }[] = [
    { value: "all", label: "All", count: long.length + clips.length + shorts.length },
    { value: "long", label: "Long form", count: long.length },
    { value: "short", label: "Short form", count: clips.length + shorts.length },
  ];

  return (
    <>
      <nav className="flex gap-6 border-b border-line px-4" aria-label="Video length">
        {filters.map((f) => {
          const active = f.value === length;
          return (
            <Link
              key={f.value}
              href={tabHref(event, "videos", f.value === "all" ? "" : `&length=${f.value}`, playing)}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 py-3 text-sm transition-colors ${
                active ? "border-accent font-semibold text-ink" : "border-transparent font-medium text-ink-dim hover:text-ink"
              }`}
            >
              {f.label} <span className="tabular font-normal text-ink-faint">{f.count}</span>
            </Link>
          );
        })}
      </nav>

      {filters[0].count === 0 && (
        <Empty>No recordings yet. They show up here as {event.channelName ?? "the channel"} uploads them.</Empty>
      )}

      {length !== "short" && long.length > 0 && (
        <VideoGridSection
          title={length === "all" ? "Long form" : null}
          videos={long}
          event={event}
          hrefFor={(v) => playHref(event, "videos", v, length === "all" ? "" : `&length=${length}`)}
        />
      )}
      {length !== "long" && shorts.length > 0 && (
        <section className="flex flex-col gap-4 px-4 pb-4 pt-6">
          <RuleLabel>Shorts</RuleLabel>
          <div className="grid grid-cols-3 gap-2">
            {shorts.map((v) => (
              <ShortCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      )}
      {length !== "long" && clips.length > 0 && (
        <VideoGridSection
          title="Clips"
          videos={clips}
          event={event}
          hrefFor={(v) => playHref(event, "videos", v, length === "all" ? "" : `&length=${length}`)}
        />
      )}
    </>
  );
}

function VideoGridSection({
  title,
  videos,
  event,
  hrefFor,
}: {
  title: string | null;
  videos: UnifiedVideo[];
  event: SeasonEvent;
  hrefFor: (video: UnifiedVideo) => string;
}) {
  return (
    <section className="flex flex-col gap-5 px-4 pb-4 pt-6">
      {title && <RuleLabel>{title}</RuleLabel>}
      <div className={VIDEO_GRID}>
        {videos.map((v) => (
          <VideoItem key={v.id} video={v} href={hrefFor(v)} event={event} />
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Livestream

function LivestreamTab({ event, now }: { event: SeasonEvent; now: number }) {
  const status = statusOf(event, now);
  const stream = liveStreamFor(event, now);
  const channelId = event.channelSlug ? youtubeChannelId(event.channelSlug) : null;
  const pastStreams = eventCoverage(event, 500).filter((v) => v.format === "stream" && v.liveStatus !== "is_live");
  // No stream was on air at the last pull (up to an hour ago) but the event
  // is on: YouTube's channel embed shows whatever is live right now.
  const src = stream
    ? `https://www.youtube-nocookie.com/embed/${stream.id.slice("yt-".length)}`
    : status === "live" && channelId
      ? `https://www.youtube.com/embed/live_stream?channel=${channelId}`
      : null;

  return (
    <>
      {src ? (
        <div className="flex flex-col gap-2 border-b border-line px-4 py-5">
          <div className="aspect-video w-full overflow-hidden rounded-sm bg-black">
            <iframe
              src={src}
              title={stream?.title ?? `${event.name} livestream`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <p className="text-[17px] font-semibold leading-snug text-ink">
            {stream ? cleanTitle(stream.title, event) : `${event.channelName}'s live stream`}
          </p>
          {!stream && <p className="text-[13px] text-ink-faint">If it says offline, nothing is streaming right now.</p>}
        </div>
      ) : (
        <Empty>
          {status === "upcoming"
            ? `The livestream appears here when ${event.name} starts, ${formatEventDates(event)}.`
            : status === "live"
              ? "Not streaming right now."
              : `${event.name} has ended.${pastStreams.length > 0 ? " Stream recordings are below." : ""}`}
        </Empty>
      )}
      {pastStreams.length > 0 && (
        <VideoGridSection
          title="Stream recordings"
          videos={pastStreams}
          event={event}
          hrefFor={(v) => playHref(event, "livestream", v)}
        />
      )}
    </>
  );
}
