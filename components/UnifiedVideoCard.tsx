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
      orgName={video.orgName}
      orgLogo={video.orgLogo}
      title={video.title}
      metaLine={[
        video.eventName,
        video.publishedAt ? formatDateShort(video.publishedAt) : "",
      ]
        .filter(Boolean)
        .join(" · ")}
      extraLine={video.speakers.length > 0 ? video.speakers.join(", ") : undefined}
    />
  );
}
