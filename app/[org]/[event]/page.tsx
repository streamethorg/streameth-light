import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VideoCard from "@/components/VideoCard";
import YoutubeVideoCard from "@/components/YoutubeVideoCard";
import {
  getOrganization,
  getEvent,
  getOrgForEvent,
  listAllEvents,
  listSessionsForEvent,
  listStagesForEvent,
} from "@/lib/data";
import { getDirectoryEntry } from "@/lib/directory";
import {
  findMatchingEventName,
  getYoutubeVideosForChannel,
  groupVideosByInferredEvent,
} from "@/lib/youtube";
import {
  getOrphanSessionsForOrg,
  groupSessionsByInferredEvent,
} from "@/lib/orphanSessions";
import { accentStyle, callSign, formatDateShort } from "@/lib/format";
import { buildMetadata } from "@/lib/social";
import type { Session, Stage } from "@/lib/types";

export function generateStaticParams() {
  return listAllEvents()
    .map((event) => {
      const org = getOrgForEvent(event);
      return org ? { org: org.slug, event: event.slug } : null;
    })
    .filter((p): p is { org: string; event: string } => p !== null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string; event: string }>;
}): Promise<Metadata> {
  const { event: eventSlug } = await params;
  const event = getEvent(eventSlug);
  if (!event) return {};
  return buildMetadata({
    title: `${event.name} — StreamETH`,
    description: event.description?.slice(0, 200),
    image: event.eventCover ?? event.banner ?? event.logo,
  });
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ org: string; event: string }>;
}) {
  const { org: orgSlug, event: eventSlug } = await params;
  const org = getOrganization(orgSlug);
  const event = getEvent(eventSlug);
  if (!org || !event || event.organizationId !== org._id) notFound();

  const sessions = listSessionsForEvent(event._id);
  const stages = listStagesForEvent(event._id);

  const stageById = new Map(stages.map((s) => [s._id, s]));
  const groups = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = stageById.has(session.stageId) ? session.stageId : "__other";
    const list = groups.get(key) ?? [];
    list.push(session);
    groups.set(key, list);
  }
  const orderedStages: (Stage | { _id: "__other"; name: "Other sessions" })[] =
    [...stages.filter((s) => groups.has(s._id))];
  if (groups.has("__other")) orderedStages.push({ _id: "__other", name: "Other sessions" });

  const directoryEntry = getDirectoryEntry(org.slug);
  const youtubeGroups = directoryEntry
    ? groupVideosByInferredEvent(getYoutubeVideosForChannel(directoryEntry.slug), directoryEntry.slug)
    : [];
  const matchedYoutubeGroup = youtubeGroups.find(
    (g) => findMatchingEventName(g.label, [event.name]) === event.name
  );

  const orphanSessionGroups = groupSessionsByInferredEvent(
    getOrphanSessionsForOrg(org._id),
    org.slug,
    org.name
  );
  const matchedOrphanGroup = orphanSessionGroups.find(
    (g) => findMatchingEventName(g.label, [event.name]) === event.name
  );
  if (matchedOrphanGroup) {
    const key = stageById.has(matchedOrphanGroup.sessions[0]?.stageId ?? "")
      ? matchedOrphanGroup.sessions[0].stageId
      : "__other";
    const list = groups.get(key) ?? [];
    groups.set(key, [...list, ...matchedOrphanGroup.sessions]);
    if (key === "__other" && !orderedStages.some((s) => s._id === "__other")) {
      orderedStages.push({ _id: "__other", name: "Other sessions" });
    }
  }

  const totalVideoCount =
    sessions.length +
    (matchedYoutubeGroup?.videos.length ?? 0) +
    (matchedOrphanGroup?.sessions.length ?? 0);

  return (
    <div
      style={accentStyle(event.accentColor ?? org.accentColor) as CSSProperties | undefined}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6"
    >
      <div className="flex flex-col gap-4">
        <Link
          href={`/${org.slug}`}
          className="w-fit font-mono text-xs uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-dim"
        >
          ← {org.name}
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          {event.name}
        </h1>
        <p className="font-mono text-xs tabular text-ink-faint">
          {event.start ? formatDateShort(event.start) : ""}
          {event.location ? ` · ${event.location}` : ""}
          {` · ${totalVideoCount} video${totalVideoCount === 1 ? "" : "s"}`}
        </p>
        {event.description && (
          <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">
            {event.description}
          </p>
        )}
      </div>

      {totalVideoCount === 0 ? (
        <p className="py-12 text-center font-mono text-sm text-ink-faint">
          No public videos found for this event.
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          {matchedYoutubeGroup && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2.5 border-b border-line pb-3">
                <span className="rounded-sm border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-accent">
                  {callSign("YouTube")}
                </span>
                <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-ink-dim">
                  From {directoryEntry?.name ?? org.name}&apos;s YouTube channel
                </h2>
                <span className="ml-auto font-mono text-xs tabular text-ink-faint">
                  {matchedYoutubeGroup.videos.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {matchedYoutubeGroup.videos.map((v) => (
                  <YoutubeVideoCard
                    key={v.videoId}
                    video={v}
                    orgSlug={org.slug}
                    groupSlug={matchedYoutubeGroup.slug}
                  />
                ))}
              </div>
            </div>
          )}
          {orderedStages.map((stage) => {
            const stageSessions = groups.get(stage._id) ?? [];
            if (stageSessions.length === 0) return null;
            return (
              <div key={stage._id} className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5 border-b border-line pb-3">
                  <span className="rounded-sm border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-accent">
                    {callSign(stage.name)}
                  </span>
                  <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-ink-dim">
                    {stage.name}
                  </h2>
                  <span className="ml-auto font-mono text-xs tabular text-ink-faint">
                    {stageSessions.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {stageSessions.map((s) => (
                    <VideoCard key={s._id} session={s} event={event} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
