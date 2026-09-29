import type { YoutubeVideo } from "@/lib/directory";
import { formatDateShort } from "@/lib/format";
import VideoTile from "./VideoTile";

export default function YoutubeVideoCard({
  video,
  orgSlug,
  groupSlug,
}: {
  video: YoutubeVideo;
  /** When known, links internally to the embedded playback page instead of out to youtube.com. */
  orgSlug?: string;
  groupSlug?: string;
}) {
  const internal = Boolean(orgSlug && groupSlug);
  return (
    <VideoTile
      href={
        internal
          ? `/${orgSlug}/y/${groupSlug}?v=${video.videoId}`
          : `https://www.youtube.com/watch?v=${video.videoId}`
      }
      external={!internal}
      coverImage={video.thumbnail}
      coverLabel={video.title}
      title={video.title}
      source={internal ? undefined : "Opens on YouTube"}
      date={video.publishedAt ? formatDateShort(video.publishedAt) : undefined}
    />
  );
}
