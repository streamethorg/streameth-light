import type { Session, Event, Organization } from "@/lib/types";
import { formatDateShort, formatTimecode } from "@/lib/format";
import { getSessionDurationSeconds } from "@/lib/browseParams";
import VideoTile, { type VideoTileLayout } from "./VideoTile";

export default function VideoCard({
  session,
  event,
  org,
  layout = "grid",
  hideChannel = false,
}: {
  session: Session;
  event?: Event;
  org?: Organization;
  layout?: VideoTileLayout;
  hideChannel?: boolean;
}) {
  const duration = getSessionDurationSeconds(session);
  const speakerNames = (session.speakers ?? []).map((sp) => sp.name).filter(Boolean);

  return (
    <VideoTile
      href={`/watch/${session._id}`}
      coverImage={session.coverImage}
      coverLabel={session.name}
      durationLabel={duration !== undefined ? formatTimecode(duration) : undefined}
      title={session.name}
      channel={hideChannel || !org ? undefined : { name: org.name, href: `/${org.slug}` }}
      speakers={layout !== "compact" && speakerNames.length > 0 ? speakerNames.join(", ") : undefined}
      event={event?.name}
      date={session.start ? formatDateShort(session.start) : undefined}
      description={layout === "row" ? session.description : undefined}
      layout={layout}
    />
  );
}
