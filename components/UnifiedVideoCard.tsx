import type { UnifiedVideo } from "@/lib/videoDb";
import { formatDateShort, formatTimecode } from "@/lib/format";
import VideoTile from "./VideoTile";

export default function UnifiedVideoCard({ video }: { video: UnifiedVideo }) {
  return (
    <VideoTile
      href={video.watchUrl}
      coverImage={video.coverImage}
      coverLabel={video.title}
      durationLabel={
        video.durationSeconds !== null ? formatTimecode(video.durationSeconds) : undefined
      }
      sourceBadge={video.source === "youtube" ? "YouTube" : undefined}
      orgName={video.orgName}
      title={video.title}
      metaLine={`${video.eventName || (video.source === "youtube" ? "YouTube" : "")}${
        video.publishedAt ? ` · ${formatDateShort(video.publishedAt)}` : ""
      }`}
      extraLine={video.speakers.length > 0 ? video.speakers.join(", ") : undefined}
    />
  );
}
