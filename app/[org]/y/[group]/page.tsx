import { notFound } from "next/navigation";
import type { Metadata } from "next";
import WatchLayout from "@/components/WatchLayout";
import YoutubeVideoCard from "@/components/YoutubeVideoCard";
import YoutubeSessionPlayer from "@/components/YoutubeSessionPlayer";
import SaveButton from "@/components/SaveButton";
import SpeakerCard from "@/components/SpeakerCard";
import { getOrganization } from "@/lib/data";
import { getDirectory, getDirectoryEntry } from "@/lib/directory";
import {
  getInferredEventGroup,
  getYoutubeVideosForChannel,
  groupVideosByInferredEvent,
} from "@/lib/youtube";
import { getVideoById } from "@/lib/videoDb";
import { formatDateLong } from "@/lib/format";
import { buildMetadata } from "@/lib/social";

export function generateStaticParams() {
  return getDirectory().flatMap((entry) => {
    const groups = groupVideosByInferredEvent(
      getYoutubeVideosForChannel(entry.slug),
      entry.slug
    );
    return groups.map((g) => ({ org: entry.slug, group: g.slug }));
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string; group: string }>;
}): Promise<Metadata> {
  const { org, group: groupSlug } = await params;
  const group = getInferredEventGroup(org, groupSlug);
  if (!group) return {};
  return buildMetadata({
    title: `${group.label} — StreamETH`,
    description: `${group.videos.length} recorded ${group.videos.length === 1 ? "talk" : "talks"} from ${group.label}.`,
    image: group.videos[0]?.thumbnail ?? undefined,
    // ?v=<video> only switches the player; the group page is the canonical.
    path: `/${org}/y/${groupSlug}`,
  });
}

export default async function YoutubeEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; group: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { org: orgSlug, group: groupSlug } = await params;
  const { v } = await searchParams;

  const group = getInferredEventGroup(orgSlug, groupSlug);
  if (!group) notFound();

  const org = getOrganization(orgSlug);
  const directoryEntry = getDirectoryEntry(orgSlug);
  const orgName = org?.name ?? directoryEntry?.name ?? orgSlug;

  const selected = (v && group.videos.find((vid) => vid.videoId === v)) || group.videos[0];
  const others = group.videos.filter((vid) => vid.videoId !== selected.videoId);
  const unified = getVideoById(`yt-${selected.videoId}`);

  return (
    <WatchLayout
      orgName={orgName}
      orgSlug={orgSlug}
      crumb={group.label}
      speakerNames={unified?.speakers}
      player={
        unified ? (
          <YoutubeSessionPlayer
            key={selected.videoId}
            videoId={selected.videoId}
            title={selected.title}
            poster={unified.coverImage}
            track={{
              source: "youtube",
              id: unified.id,
              title: unified.title,
              orgName: orgName,
              coverImage: unified.coverImage,
              watchUrl: unified.watchUrl,
              videoId: selected.videoId,
            }}
          />
        ) : (
          <div className="aspect-video w-full overflow-hidden rounded-md border border-line bg-black">
            <iframe
              key={selected.videoId}
              src={`https://www.youtube-nocookie.com/embed/${selected.videoId}`}
              title={selected.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        )
      }
      title={selected.title}
      actions={
        unified && (
          <SaveButton
            videoId={unified.id}
            videoSource="youtube"
            title={unified.title}
            coverImage={unified.coverImage}
          />
        )
      }
      metaLine={selected.publishedAt ? formatDateLong(selected.publishedAt) : undefined}
      description={selected.description || unified?.description}
      transcript={unified?.transcript}
      speakers={
        unified &&
        unified.speakers.length > 0 && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            {unified.speakers.map((name) => (
              <SpeakerCard key={name} speaker={{ _id: name, name }} compact />
            ))}
          </div>
        )
      }
      videoId={unified?.id}
      relatedLabel={`More from ${group.label}`}
      related={others.map((vid) => (
        <YoutubeVideoCard
          key={vid.videoId}
          video={vid}
          orgSlug={orgSlug}
          groupSlug={groupSlug}
          layout="compact"
        />
      ))}
    />
  );
}
