import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import { cache } from "react";
import type { Event, Organization, Session, Speaker, Stage } from "./types";

function load<T>(file: string): T {
  const raw = readFileSync(join(process.cwd(), "data", file), "utf-8");
  return JSON.parse(raw) as T;
}

const HAS_VIDEO = (s: Session) =>
  Boolean(s.playbackId || s.videoUrl || s.playback?.videoUrl);

export const getStore = cache(() => {
  const organizations = load<Organization[]>("organizations.json").filter(
    (o) => o.slug
  );
  const events = load<Event[]>("events.json").filter(
    (e) => e.slug && !e.unlisted
  );
  const stages = load<Stage[]>("stages.json");
  const speakers = load<Speaker[]>("speakers.json");
  const sessions = load<Session[]>("sessions.json")
    .filter(HAS_VIDEO)
    .sort((a, b) => b.start - a.start);

  const orgById = new Map(organizations.map((o) => [o._id, o]));
  const orgBySlug = new Map(organizations.map((o) => [o.slug, o]));
  const eventById = new Map(events.map((e) => [e._id, e]));
  const eventBySlug = new Map(events.map((e) => [e.slug, e]));
  const stageById = new Map(stages.map((s) => [s._id, s]));
  const sessionById = new Map(sessions.map((s) => [s._id, s]));

  const eventsByOrg = new Map<string, Event[]>();
  for (const e of events) {
    const list = eventsByOrg.get(e.organizationId) ?? [];
    list.push(e);
    eventsByOrg.set(e.organizationId, list);
  }
  for (const list of eventsByOrg.values()) {
    list.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }

  const sessionsByEvent = new Map<string, Session[]>();
  for (const s of sessions) {
    const list = sessionsByEvent.get(s.eventId) ?? [];
    list.push(s);
    sessionsByEvent.set(s.eventId, list);
  }

  const stagesByEvent = new Map<string, Stage[]>();
  for (const st of stages) {
    const list = stagesByEvent.get(st.eventId) ?? [];
    list.push(st);
    stagesByEvent.set(st.eventId, list);
  }
  for (const list of stagesByEvent.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const speakersByEvent = new Map<string, Speaker[]>();
  for (const sp of speakers) {
    const list = speakersByEvent.get(sp.eventId) ?? [];
    list.push(sp);
    speakersByEvent.set(sp.eventId, list);
  }

  const sessionCountByOrg = new Map<string, number>();
  for (const s of sessions) {
    sessionCountByOrg.set(
      s.organizationId,
      (sessionCountByOrg.get(s.organizationId) ?? 0) + 1
    );
  }

  return {
    organizations,
    events,
    stages,
    speakers,
    sessions,
    orgById,
    orgBySlug,
    eventById,
    eventBySlug,
    stageById,
    sessionById,
    eventsByOrg,
    sessionsByEvent,
    stagesByEvent,
    speakersByEvent,
    sessionCountByOrg,
  };
});

export function listOrganizations(): Organization[] {
  return getStore().organizations;
}

export function listAllSessions(): Session[] {
  return getStore().sessions;
}

export function listAllEvents(): Event[] {
  return getStore().events;
}

export function getOrganization(slug: string): Organization | undefined {
  return getStore().orgBySlug.get(slug);
}

export function getOrgSessionCount(orgId: string): number {
  return getStore().sessionCountByOrg.get(orgId) ?? 0;
}

export function listEventsForOrg(orgId: string): Event[] {
  return getStore().eventsByOrg.get(orgId) ?? [];
}

export function getEvent(slug: string): Event | undefined {
  return getStore().eventBySlug.get(slug);
}

export function getEventById(eventId: string): Event | undefined {
  return getStore().eventById.get(eventId);
}

export function getOrgForEvent(event: Event | undefined): Organization | undefined {
  return event ? getStore().orgById.get(event.organizationId) : undefined;
}

export function listSessionsForEvent(eventId: string): Session[] {
  return getStore().sessionsByEvent.get(eventId) ?? [];
}

export function listStagesForEvent(eventId: string): Stage[] {
  return getStore().stagesByEvent.get(eventId) ?? [];
}

export function listSpeakersForEvent(eventId: string): Speaker[] {
  return getStore().speakersByEvent.get(eventId) ?? [];
}

export function getStage(stageId: string): Stage | undefined {
  return getStore().stageById.get(stageId);
}

export function getSession(sessionId: string): Session | undefined {
  return getStore().sessionById.get(sessionId);
}

export function getSessionVideoUrl(session: Session): string | undefined {
  return session.videoUrl || session.playback?.videoUrl;
}

export function buildPlaybackSrc(
  session: Session
): { src: string; type: "hls" | "mp4" } | undefined {
  if (session.playbackId) {
    return {
      src: `https://livepeercdn.studio/hls/${session.playbackId}/index.m3u8`,
      type: "hls",
    };
  }
  if (session.videoUrl) {
    return {
      src: session.videoUrl,
      type: session.videoUrl.endsWith(".m3u8") ? "hls" : "mp4",
    };
  }
  if (session.playback?.videoUrl) {
    return { src: session.playback.videoUrl, type: "mp4" };
  }
  return undefined;
}

export function relatedSessions(session: Session, limit = 8): Session[] {
  const all = listSessionsForEvent(session.eventId).filter(
    (s) => s._id !== session._id
  );
  return all.slice(0, limit);
}
