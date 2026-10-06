import Link from "next/link";
import UnifiedVideoCard from "./UnifiedVideoCard";
import type { NewTalksGroup } from "@/lib/events";

const MIN_ROW_TALKS = 3;

/** The "keep up" feed: what was published recently, one block per event —
 * a header line (event, channel, how many new talks) over a row of its
 * newest talks. The row swipes sideways on phones and shows exactly one
 * row of the grid on wider screens. */
export default function NewTalks({ groups }: { groups: NewTalksGroup[] }) {
  // An event with one or two new talks would leave most of its row empty;
  // those are pooled into one "More new talks" row at the end instead.
  const big = groups.filter((g) => g.videos.length >= MIN_ROW_TALKS);
  const pooled = groups.filter((g) => g.videos.length < MIN_ROW_TALKS).flatMap((g) => g.videos);

  return (
    <div className="flex flex-col gap-10">
      {big.map((group) => {
        const count = group.videos.length;
        return (
          <section key={group.key} className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link href={group.href} className="truncate text-base font-semibold text-ink hover:text-accent">
                  {group.name}
                </Link>
                <p className="text-sm text-ink-faint">
                  {group.channelName !== group.name && (
                    <>
                      <Link href={group.channelHref} className="hover:text-ink">
                        {group.channelName}
                      </Link>
                      <span aria-hidden="true"> · </span>
                    </>
                  )}
                  {group.location && (
                    <>
                      {group.location}
                      <span aria-hidden="true"> · </span>
                    </>
                  )}
                  <span className="font-medium text-accent">
                    {count} new {count === 1 ? "talk" : "talks"}
                  </span>
                </p>
              </div>
              <Link href={group.href} className="shrink-0 text-sm font-medium text-ink-dim hover:text-accent">
                See all →
              </Link>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] min-[560px]:mx-0 min-[560px]:grid min-[560px]:snap-none min-[560px]:grid-cols-2 min-[560px]:overflow-visible min-[560px]:px-0 min-[560px]:max-lg:[&>*:nth-child(n+3)]:hidden lg:grid-cols-3 lg:max-2xl:[&>*:nth-child(n+4)]:hidden 2xl:grid-cols-4 2xl:[&>*:nth-child(n+5)]:hidden">
              {group.videos.slice(0, 4).map((v) => (
                <div key={v.id} className="w-[78%] shrink-0 snap-start min-[560px]:w-auto">
                  <UnifiedVideoCard video={v} hideChannel hideEvent />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {pooled.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-ink">
            {big.length > 0 ? "More new talks" : "New talks"}
          </h3>
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {pooled.map((v) => (
              <UnifiedVideoCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
