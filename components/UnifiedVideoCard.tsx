import type { UnifiedVideo } from "@/lib/videoDb";
import { formatDateShort, formatTimecode, withoutEventSuffix } from "@/lib/format";
import VideoTile, { type VideoTileLayout } from "./VideoTile";
import { videoLink } from "@/lib/videoLink";

export default function UnifiedVideoCard({
  video,
  layout = "grid",
  hideChannel = false,
  hideEvent = false,
  href,
  eventName,
}: {
  video: UnifiedVideo;
  layout?: VideoTileLayout;
  /** Omit the channel, e.g. on that channel's own page. */
  hideChannel?: boolean;
  /** Omit the event, e.g. in a row already headed by that event. */
  hideEvent?: boolean;
  /** Where the card opens, when not the watch page (e.g. playing it in
   * place on an event page). */
  href?: string;
  /** The event the surrounding page or section is about; a title ending in
   * its name ("… - TOKEN2049 Singapore 2026") drops that suffix. */
  eventName?: string;
}) {
  return (
    <VideoTile
      href={href ?? videoLink(video)}
      coverImage={video.coverImage}
      coverLabel={video.title}
      durationLabel={
        video.durationSeconds !== null ? formatTimecode(video.durationSeconds) : undefined
      }
      // The meta line (or the page around the card) already names the event.
      title={withoutEventSuffix(video.title, eventName, video.eventName, video.orgName)}
      channel={
        hideChannel || !video.orgName
          ? undefined
          : { name: video.orgName, href: video.orgSlug ? `/${video.orgSlug}` : undefined }
      }
      speakers={video.speakers.length > 0 ? video.speakers.join(", ") : undefined}
      event={hideEvent ? undefined : video.eventName || undefined}
      date={video.publishedAt ? formatDateShort(video.publishedAt) : undefined}
      description={layout === "row" ? video.description : undefined}
      layout={layout}
    />
  );
}
