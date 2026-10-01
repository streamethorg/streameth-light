import Link from "next/link";
import PageHero, { HeroLink } from "@/components/PageHero";
import SectionHeader from "@/components/SectionHeader";
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
import { accentStyle, formatDateShort } from "@/lib/format";
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

  const visibleStages = orderedStages.filter((stage) => (groups.get(stage._id)?.length ?? 0) > 0);
  const stageAnchor = (id: string) => `stage-${id}`;

  return (
    <div
      style={accentStyle(event.accentColor ?? org.accentColor) as CSSProperties | undefined}
      className="flex flex-1 flex-col"
    >
      <PageHero
        back={{ href: `/${org.slug}`, label: org.name }}
        title={event.name}
        meta={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {event.start && <span className="font-medium text-ink">{formatDateShort(event.start)}</span>}
            {event.location && <span>{event.location}</span>}
            <span>
              {totalVideoCount.toLocaleString()} {totalVideoCount === 1 ? "video" : "videos"}
            </span>
          </span>
        }
        description={event.description}
        actions={
          visibleStages.length > 1 &&
          visibleStages.map((stage) => (
            <HeroLink key={stage._id} href={`#${stageAnchor(stage._id)}`}>
              {stage.name}
            </HeroLink>
          ))
        }
      />

      <div className="flex flex-1 flex-col gap-10 px-4 py-6 sm:px-6">
        {totalVideoCount === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-panel px-6 py-14 text-center ring-1 ring-line">
            <p className="text-lg font-bold tracking-[-0.01em] text-ink">No public videos yet</p>
            <p className="max-w-md text-sm text-ink-dim">
              Nothing from {event.name} has been published. Other {org.name} events may have
              recordings.
            </p>
            <Link
              href={`/${org.slug}`}
              className="mt-2 rounded-full bg-stage px-5 py-2.5 text-sm font-semibold text-stage-ink transition-colors hover:bg-accent"
            >
              See all {org.name} events
            </Link>
          </div>
        ) : (
          <>
            {matchedYoutubeGroup && (
              <div className="flex flex-col gap-5">
                <SectionHeader
                  title={`From ${directoryEntry?.name ?? org.name}'s YouTube channel`}
                  detail={`${matchedYoutubeGroup.videos.length} videos`}
                />
                <div className="grid grid-cols-1 gap-x-4 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
            {visibleStages.map((stage) => {
              const stageSessions = groups.get(stage._id) ?? [];
              return (
                <div key={stage._id} id={stageAnchor(stage._id)} className="flex scroll-mt-24 flex-col gap-5">
                  <SectionHeader
                    title={stage.name}
                    detail={`${stageSessions.length} ${stageSessions.length === 1 ? "talk" : "talks"}`}
                  />
                  <div className="grid grid-cols-1 gap-x-4 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {stageSessions.map((s) => (
                      <VideoCard key={s._id} session={s} event={event} org={org} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
