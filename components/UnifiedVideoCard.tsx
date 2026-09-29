import type { UnifiedVideo } from "@/lib/videoDb";
import { formatDateShort, formatTimecode } from "@/lib/format";
import VideoTile from "./VideoTile";

export default function UnifiedVideoCard({
  video,
  lead = false,
  hideSource = false,
}: {
  video: UnifiedVideo;
  lead?: boolean;
  /** Omit the event/channel line, e.g. inside a row already titled with it. */
  hideSource?: boolean;
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
      speakers={video.speakers.length > 0 ? video.speakers.join(", ") : undefined}
      source={hideSource ? undefined : video.eventName || video.orgName}
      date={video.publishedAt ? formatDateShort(video.publishedAt) : undefined}
      lead={lead}
    />
  );
}
