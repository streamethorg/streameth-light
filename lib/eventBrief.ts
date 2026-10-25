import "server-only";
import {
  eventCoverage,
  eventSpeakers,
  formatEventDates,
  getSchedule,
  sideEventsFor,
  statusLine,
  type SeasonEvent,
} from "./season";
import { listStoriesForEvents, visibleOn } from "./stories";
import { listEmbedsForEvents } from "./embeds";
import { mediaLabel } from "./embedCore.mjs";

/** One citable piece of an event's page for Ask: the overview, the agenda,
 * the speakers, a story, a link a reporter shared. */
export interface BriefSection {
  /** Unique within the event, for the source list. */
  id: string;
  title: string;
  /** Where a citation of it links. */
  url: string;
  coverImage: string | null;
  text: string;
}

// Budgets per part, in characters, so a big event (Devcon: hundreds of
// sessions and speakers) still fits alongside search results.
const SCHEDULE_CHARS = 30_000;
const SPEAKERS_CHARS = 15_000;
const RECORDINGS_CHARS = 12_000;
const SIDE_EVENTS_CHARS = 6_000;
const STORIES = 12;
const EMBEDS = 30;

function capped(lines: string[], max: number, more: (left: number) => string): string {
  const out: string[] = [];
  let size = 0;
  for (const [i, line] of lines.entries()) {
    if (size + line.length > max && out.length > 0) {
      out.push(more(lines.length - i));
      break;
    }
    out.push(line);
    size += line.length + 1;
  }
  return out.join("\n");
}

function oneLine(text: string | null | undefined, max = 600): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** "Tue, Nov 3, 10:30" in the event's zone. */
function sessionWhen(ms: number, timeZone: string | null): string {
  return new Date(ms).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone ?? "UTC",
  });
}

/** Everything on an event's page that isn't a transcript, as citable
 * sections: overview, agenda, speakers, side events, the recordings list,
 * stories, and links reporters shared. Ask puts these in front of the
 * model alongside transcript search, so it can answer "who's speaking on
 * day 2", "where is it", "what did reporters say" — not only "what was
 * said on stage". */
export async function eventBrief(event: SeasonEvent, now: number): Promise<BriefSection[]> {
  const page = event.href ?? "";
  const tab = (t: string) => (page ? `${page}?tab=${t}` : page);
  const sections: BriefSection[] = [];

  const recordings = eventCoverage(event, 1000).filter((v) => v.liveStatus !== "is_upcoming");
  const schedule = getSchedule(event);
  const place = [...new Set([event.city, event.country].filter(Boolean))].join(", ");
  sections.push({
    id: "overview",
    title: `${event.name} — about the event`,
    url: tab("info"),
    coverImage: event.imageUrl,
    text: [
      `Event: ${event.name}`,
      `Dates: ${formatEventDates(event)} (${statusLine(event, now)})`,
      place ? `Where: ${place}` : "",
      event.channelName ? `Covered by: ${event.channelName}` : "",
      event.website ? `Website: ${event.website}` : "",
      schedule ? `Agenda: ${schedule.sessions.length} sessions on ${schedule.rooms.length} stages (${schedule.rooms.join(", ")})` : "Agenda: not published",
      `Recordings so far: ${recordings.length} (${recordings.filter((v) => v.hasTranscript).length} transcribed)`,
      event.description ? `Description: ${oneLine(event.description, 3000)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (schedule && schedule.sessions.length > 0) {
    const lines = [...schedule.sessions]
      .sort((a, b) => a.start - b.start)
      .map(
        (s) =>
          `${sessionWhen(s.start, event.timeZone)} · ${s.room} · ${s.title}${s.speakers.length ? ` — ${s.speakers.join(", ")}` : ""}${
            s.type ? ` (${s.type})` : ""
          }`
      );
    sections.push({
      id: "schedule",
      title: `${event.name} — agenda`,
      url: tab("info"),
      coverImage: event.imageUrl,
      text: `Agenda (times are local to the event${event.timeZone ? `, ${event.timeZone}` : ""}):\n${capped(
        lines,
        SCHEDULE_CHARS,
        (left) => `(${left} more sessions not shown)`
      )}`,
    });
  }

  const speakers = eventSpeakers(event);
  if (speakers.length > 0) {
    const lines = speakers.map((sp) =>
      [
        sp.name,
        sp.twitter ? `@${sp.twitter}` : "",
        sp.bio ? oneLine(sp.bio, 300) : "",
        sp.sessions.length ? `Sessions: ${sp.sessions.map((s) => s.title).join("; ")}` : "",
        sp.videos.length ? `Recordings: ${sp.videos.map((v) => v.title).join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(" — ")
    );
    sections.push({
      id: "speakers",
      title: `${event.name} — speakers`,
      url: tab("speakers"),
      coverImage: event.imageUrl,
      text: `Speakers (${speakers.length}):\n${capped(lines, SPEAKERS_CHARS, (left) => `(${left} more speakers not shown)`)}`,
    });
  }

  const sideEvents = sideEventsFor(event).filter((e) => (e.startTime ?? "") >= event.start.slice(0, 7));
  if (sideEvents.length > 0) {
    const lines = sideEvents.map((e) =>
      [
        e.name,
        e.startTime ? e.startTime.slice(0, 16).replace("T", " ") : "",
        [e.location, e.city].filter(Boolean).join(", "),
        e.organizer ? `by ${e.organizer}` : "",
        e.website ?? "",
      ]
        .filter(Boolean)
        .join(" · ")
    );
    sections.push({
      id: "side-events",
      title: `${event.name} — side events`,
      url: tab("info"),
      coverImage: event.imageUrl,
      text: `Side events (${sideEvents.length}):\n${capped(lines, SIDE_EVENTS_CHARS, (left) => `(${left} more not shown)`)}`,
    });
  }

  if (recordings.length > 0) {
    const lines = recordings.map((v) =>
      [
        new Date(v.publishedAt).toISOString().slice(0, 10),
        v.format,
        v.title,
        v.speakers.length ? `— ${v.speakers.join(", ")}` : "",
        v.hasTranscript ? "" : "(no transcript)",
      ]
        .filter(Boolean)
        .join(" ")
    );
    sections.push({
      id: "recordings",
      title: `${event.name} — recordings`,
      url: tab("videos"),
      coverImage: recordings.find((v) => v.coverImage)?.coverImage ?? event.imageUrl,
      text: `Recordings, newest first (search_archive reads the transcribed ones):\n${capped(
        lines,
        RECORDINGS_CHARS,
        (left) => `(${left} more recordings not shown)`
      )}`,
    });
  }

  for (const story of (await listStoriesForEvents([event.key], STORIES)).filter((s) => visibleOn(s.reporter?.trust, "event"))) {
    sections.push({
      id: `story:${story.id}`,
      title: story.headline,
      url: `/stories/${story.slug}`,
      coverImage: story.sources.find((s) => s.coverImage)?.coverImage ?? null,
      text: `Story by ${story.reporter?.name ?? "a reporter"} (${story.writtenAt.slice(0, 10)}): ${story.headline}\n${oneLine(
        story.standfirst
      )}\n${oneLine(story.body, 2500)}`,
    });
  }

  for (const embed of (await listEmbedsForEvents([event.key], EMBEDS)).filter((e) => visibleOn(e.reporter.trust, "event"))) {
    sections.push({
      id: `embed:${embed.id}`,
      title: embed.title || embed.url,
      url: embed.url,
      coverImage: embed.imageUrl,
      text: [
        `${mediaLabel(embed.provider, embed.variant)} shared by ${embed.reporter.name} (${embed.createdAt.slice(0, 10)}): ${embed.title}`,
        embed.authorName ? `By: ${embed.authorName}` : "",
        embed.note ? `Reporter's note: ${embed.note}` : "",
        embed.description ? oneLine(embed.description, 1000) : "",
        `Link: ${embed.url}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  return sections;
}
