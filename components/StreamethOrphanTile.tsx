import Link from "next/link";
import type { InferredSessionGroup } from "@/lib/orphanSessions";
import CoverPlaceholder from "./CoverPlaceholder";

export default function StreamethOrphanTile({
  orgSlug,
  group,
}: {
  orgSlug: string;
  group: InferredSessionGroup;
}) {
  const cover = group.sessions[0]?.coverImage;

  return (
    <Link
      href={`/${orgSlug}/s/${group.slug}`}
      className="group flex flex-col overflow-hidden rounded-md border border-line bg-panel transition-colors hover:border-accent/50"
    >
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-panel-raised">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <CoverPlaceholder label={group.label} />
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <h2 className="font-display text-sm font-bold leading-snug text-ink group-hover:text-accent">
          {group.label}
        </h2>
        <p className="font-mono text-[11px] tabular text-ink-dim">
          {String(group.sessions.length).padStart(2, "0")} video
          {group.sessions.length === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}
