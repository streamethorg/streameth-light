import type { InferredEventGroup } from "@/lib/youtube";
import { formatDateShort } from "@/lib/format";
import EventTile from "./EventTile";

export default function YoutubeEventTile({
  orgSlug,
  group,
  href,
}: {
  orgSlug: string;
  group: InferredEventGroup;
  /** The group's coverage page, when it has one. */
  href?: string;
}) {
  const latest = group.videos[0];

  return (
    <EventTile
      href={href ?? `/${orgSlug}/y/${group.slug}`}
      cover={latest.thumbnail}
      title={group.label}
      count={group.videos.length}
      when={latest.publishedAt ? `Latest ${formatDateShort(latest.publishedAt)}` : undefined}
    />
  );
}
