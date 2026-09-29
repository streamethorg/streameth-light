import type { Event } from "@/lib/types";
import { formatDateShort } from "@/lib/format";
import { usableImage } from "@/lib/data";
import EventTile from "./EventTile";

export default function EventCard({
  event,
  orgSlug,
  count,
  extraVideoCount = 0,
  fallbackCover,
}: {
  event: Event;
  orgSlug: string;
  count: number;
  extraVideoCount?: number;
  fallbackCover?: string | null;
}) {
  const cover = usableImage(event.eventCover) ?? usableImage(event.banner) ?? fallbackCover;

  return (
    <EventTile
      href={`/${orgSlug}/${event.slug}`}
      cover={cover}
      title={event.name}
      count={count + extraVideoCount}
      when={event.start ? formatDateShort(event.start) : undefined}
      where={event.location}
    />
  );
}
