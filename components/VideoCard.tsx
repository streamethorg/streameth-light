import type { Session, Event, Organization } from "@/lib/types";
import { formatDateShort, formatTimecode } from "@/lib/format";
import { getSessionDurationSeconds } from "@/lib/browseParams";
import VideoTile from "./VideoTile";

export default function VideoCard({
  session,
  event,
  org,
}: {
  session: Session;
  event?: Event;
  org?: Organization;
}) {
  const duration = getSessionDurationSeconds(session);
  const speakerNames = (session.speakers ?? []).map((sp) => sp.name).filter(Boolean);

  return (
    <VideoTile
      href={`/watch/${session._id}`}
      coverImage={session.coverImage}
      coverLabel={session.name}
      durationLabel={duration !== undefined ? formatTimecode(duration) : undefined}
      orgName={org?.name}
      title={session.name}
      metaLine={[event?.name ?? session.eventSlug, session.start ? formatDateShort(session.start) : ""]
        .filter(Boolean)
        .join(" · ")}
      extraLine={speakerNames.length > 0 ? speakerNames.join(", ") : undefined}
    />
  );
}
