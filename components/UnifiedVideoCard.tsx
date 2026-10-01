import type { UnifiedVideo } from "@/lib/videoDb";
import { formatDateShort, formatTimecode } from "@/lib/format";
import VideoTile, { type VideoTileLayout } from "./VideoTile";

export default function UnifiedVideoCard({
  video,
  layout = "grid",
  hideChannel = false,
}: {
  video: UnifiedVideo;
  layout?: VideoTileLayout;
  /** Omit the channel, e.g. on that channel's own page. */
  hideChannel?: boolean;
}) {
  return (
    <VideoTile
      href={video.watchUrl}
      coverImage={video.coverImage}
      coverLabel={video.title}
      durationLabel={
        video.durationSeconds !== null ? formatTimecode(video.durationSeconds) : undefined
      }
      title={video.title}
      channel={
        hideChannel || !video.orgName
          ? undefined
          : { name: video.orgName, href: video.orgSlug ? `/${video.orgSlug}` : undefined }
      }
      speakers={layout !== "compact" && video.speakers.length > 0 ? video.speakers.join(", ") : undefined}
      event={video.eventName || undefined}
      date={video.publishedAt ? formatDateShort(video.publishedAt) : undefined}
      description={layout === "row" ? video.description : undefined}
      layout={layout}
    />
  );
}
