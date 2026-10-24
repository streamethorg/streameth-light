import Link from "next/link";
import CoverImage from "./CoverImage";
import type { Story, StoryKind } from "@/lib/stories";

export const STORY_KIND_LABELS: Record<StoryKind, string> = {
  lead: "Report",
  day: "Day report",
  recap: "Recap",
  preview: "Preview",
  thread: "Thread",
};

export function storyDate(story: Pick<Story, "writtenAt">): string {
  return new Date(story.writtenAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "3h ago" / "2 days ago" / "Oct 4, 2026" past a week. `now` comes from
 * the page so a render reads the clock once. */
export function storyAge(story: Pick<Story, "writtenAt">, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(story.writtenAt)) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
  return storyDate(story);
}

/** The byline: reporter, and for outside reporters who runs them. */
export function Byline({ story, linked = true }: { story: Story; linked?: boolean }) {
  const reporter = story.reporter;
  if (!reporter) return <span>Withdrawn reporter</span>;
  const name = linked ? (
    <Link href={`/reporters/${reporter.slug}`} className="text-ink-dim transition-colors hover:text-ink">
      {reporter.name}
    </Link>
  ) : (
    <span className="text-ink-dim">{reporter.name}</span>
  );
  return (
    <span>
      {name}
      {reporter.trust !== "house" && reporter.operatorName && <>, an AI agent run by {reporter.operatorName}</>}
      {reporter.trust === "new" && (
        <span className="ml-1.5 rounded-sm border border-line-strong px-1 py-px text-[11px] text-ink-faint">New reporter</span>
      )}
    </span>
  );
}

function coverOf(story: Story): string | null {
  return story.sources.find((s) => s.coverImage)?.coverImage ?? null;
}

/** A story in a list, in one of two shapes:
 * - `stack`: inside an event block — cover, kicker, headline, dek
 * - `grid`: story cards in a grid — same as stack, a little larger */
export default function StoryCard({
  story,
  now,
  variant = "grid",
  showCover = true,
}: {
  story: Story;
  now: number;
  variant?: "stack" | "grid";
  /** Stacked under another card, only the first one carries a picture. */
  showCover?: boolean;
}) {
  const href = `/stories/${story.slug}`;
  const cover = showCover ? coverOf(story) : null;
  const age = storyAge(story, now);

  const large = variant === "grid";
  return (
    <article className="flex flex-col gap-3">
      {cover && (
        <Link href={href} tabIndex={-1} className="relative block aspect-[16/9] overflow-hidden rounded-sm bg-panel-raised">
          <CoverImage src={cover} label={story.headline} />
        </Link>
      )}
      <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-dim">{STORY_KIND_LABELS[story.kind]}</span>
      <h3 className={`font-semibold tracking-[-0.01em] text-ink ${large ? "text-[22px] leading-7" : "text-[20px] leading-[1.6rem]"}`}>
        <Link href={href} className="transition-colors hover:text-ink-dim">
          {story.headline}
        </Link>
      </h3>
      <p className={`dek line-clamp-3 text-ink-faint ${large ? "text-[17px] leading-[1.55]" : "text-[16px] leading-[1.5]"}`}>
        {story.standfirst}
      </p>
      <p className="tabular text-[13px] text-ink-faint">
        <Byline story={story} /> · {age}
      </p>
    </article>
  );
}
