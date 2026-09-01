import Link from "next/link";
import type { YoutubeVideo } from "@/lib/directory";
import { formatDateShort } from "@/lib/format";

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
  const content = (
    <>
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-panel">
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            No preview
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-void/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink">
          YouTube
        </span>
        <span className="absolute inset-0 ring-1 ring-inset ring-white/5 transition-colors group-hover:ring-accent/40" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
          {video.title}
        </h3>
        {video.publishedAt && (
          <p className="font-mono text-[11px] text-ink-faint">
            {formatDateShort(video.publishedAt)}
          </p>
        )}
      </div>
    </>
  );

  if (orgSlug && groupSlug) {
    return (
      <Link
        href={`/${orgSlug}/y/${groupSlug}?v=${video.videoId}`}
        className="group flex flex-col gap-2.5"
      >
        {content}
      </Link>
    );
  }

  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.videoId}`}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col gap-2.5"
    >
      {content}
    </a>
  );
}
