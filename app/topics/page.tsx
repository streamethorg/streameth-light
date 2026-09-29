import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { listTopics } from "@/lib/topics";

export const metadata: Metadata = {
  title: "Topics — StreamETH",
  description: "Browse sessions by autodetected topic.",
};

export default function TopicsPage() {
  const topics = listTopics();

  // Three type sizes by talk count, so the big subjects of the archive
  // stand out and the long tail stays scannable.
  const counts = topics.map((t) => t.sessionIds.length).sort((a, b) => b - a);
  const large = counts[Math.floor(counts.length * 0.08)] ?? Infinity;
  const medium = counts[Math.floor(counts.length * 0.3)] ?? Infinity;

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Topics"
        meta={`${topics.length} subjects, detected from the talks themselves`}
      />
      <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-3">
          {topics.map((t) => {
            const n = t.sessionIds.length;
            const size =
              n >= large
                ? "px-5 py-2.5 text-xl font-bold tracking-[-0.02em]"
                : n >= medium
                  ? "px-4 py-2 text-base font-semibold"
                  : "px-3 py-1.5 text-sm font-medium";
            return (
              <Link
                key={t.slug}
                href={`/topics/${t.slug}`}
                className={`group flex items-baseline gap-2 rounded-lg bg-panel-raised text-ink transition-colors hover:bg-panel-hover ${size}`}
              >
                {t.name}
                <span className="tabular text-xs font-medium text-ink-faint">
                  {n}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
