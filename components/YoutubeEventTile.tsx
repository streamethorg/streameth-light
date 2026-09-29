import type { InferredEventGroup } from "@/lib/youtube";
import { formatDateShort } from "@/lib/format";
import EventTile from "./EventTile";

export default function YoutubeEventTile({
  orgSlug,
  group,
}: {
  orgSlug: string;
  group: InferredEventGroup;
}) {
  const latest = group.videos[0];

  return (
    <EventTile
      href={`/${orgSlug}/y/${group.slug}`}
      cover={latest.thumbnail}
      title={group.label}
      count={group.videos.length}
      when={latest.publishedAt ? `Latest ${formatDateShort(latest.publishedAt)}` : undefined}
    />
  );
}
