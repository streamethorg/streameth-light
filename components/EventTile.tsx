import Link from "next/link";
import CoverImage from "./CoverImage";

/** An event as a poster: its cover (or the newest talk's thumbnail) with the
 * event name set large over a dark fade, video count in the corner, and
 * when/where underneath. Shared by StreamETH events, YouTube-inferred event
 * groups, and orphaned-session groups so they all look like one thing. */
export default function EventTile({
  href,
  cover,
  title,
  count,
  when,
  where,
}: {
  href: string;
  cover?: string | null;
  title: string;
  count: number;
  when?: string;
  where?: string;
}) {
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded-xl outline-offset-4">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-stage">
        <CoverImage
          src={cover}
          label={title}
          className="transition duration-500 ease-out group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stage via-stage/40 to-transparent" />
        <span className="tabular absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-stage">
          {count.toLocaleString()} {count === 1 ? "video" : "videos"}
        </span>
        <h3 className="display absolute inset-x-4 bottom-4 line-clamp-2 text-[1.6rem] leading-[1.02] text-white">
          {title}
        </h3>
        <span className="brand-gradient absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100" />
      </div>
      {(when || where) && (
        <p className="flex flex-wrap gap-x-3 text-sm text-ink-faint">
          {when && <span className="font-medium text-ink-dim">{when}</span>}
          {where && <span>{where}</span>}
        </p>
      )}
    </Link>
  );
}
