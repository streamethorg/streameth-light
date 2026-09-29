import Link from "next/link";
import { listTopics } from "@/lib/topics";
import { buildMetadata } from "@/lib/social";

export const metadata = buildMetadata({
  title: "Topics — StreamETH",
  description: "Browse sessions by autodetected topic.",
});

export default function TopicsPage() {
  const topics = listTopics();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          Topics
        </h1>
        <p className="font-mono text-xs tabular text-ink-faint">
          {topics.length} topics detected across the archive
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <Link
            key={t.slug}
            href={`/topics/${t.slug}`}
            className="group flex items-center gap-1.5 rounded-sm border border-line bg-panel px-3 py-1.5 transition-colors hover:border-accent/50"
          >
            <span className="text-xs text-ink group-hover:text-accent">
              {t.name}
            </span>
            <span className="font-mono text-[10px] tabular text-ink-faint">
              {t.sessionIds.length}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
