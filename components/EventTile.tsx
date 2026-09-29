import Link from "next/link";
import CoverImage from "./CoverImage";

/** An event: its cover (or the newest talk's thumbnail), name, and when /
 * where / how many talks. Shared by StreamETH events, YouTube-inferred
 * event groups, and orphaned-session groups so they all look like one thing. */
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
    <Link href={href} className="group flex flex-col gap-3 rounded-lg outline-offset-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-stage">
        <CoverImage
          src={cover}
          label={title}
          className="transition duration-300 ease-out group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-[-0.02em] text-ink decoration-accent decoration-2 underline-offset-[5px] group-hover:underline">
          {title}
        </h3>
        <p className="flex flex-wrap gap-x-2.5 text-[13px] text-ink-faint">
          <span className="font-medium text-ink-dim">
            {count.toLocaleString()} {count === 1 ? "talk" : "talks"}
          </span>
          {when && <span className="tabular">{when}</span>}
          {where && <span>{where}</span>}
        </p>
      </div>
    </Link>
  );
}
