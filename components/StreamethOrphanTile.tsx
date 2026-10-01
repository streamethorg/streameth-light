import type { InferredSessionGroup } from "@/lib/orphanSessions";
import { formatDateShort } from "@/lib/format";
import EventTile from "./EventTile";

export default function StreamethOrphanTile({
  orgSlug,
  group,
}: {
  orgSlug: string;
  group: InferredSessionGroup;
}) {
  const first = group.sessions[0];

  return (
    <EventTile
      href={`/${orgSlug}/s/${group.slug}`}
      cover={first?.coverImage}
      title={group.label}
      count={group.sessions.length}
      when={first?.start ? formatDateShort(first.start) : undefined}
    />
  );
}
