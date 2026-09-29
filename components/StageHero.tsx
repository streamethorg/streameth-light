import Link from "next/link";
import HomeSearchHero from "@/components/HomeSearchHero";

// Real searches with hundreds of matching talks each (checked against the
// FTS index) — a starting point for people who don't know what to type.
const STARTER_SEARCHES = ["account abstraction", "zero knowledge", "MEV", "restaking", "stablecoins"];

/** The homepage's opening: the flat stage band (same color as the header,
 * so they read as one surface) holding nothing but the search. */
export default function StageHero({ stats }: { stats: { videos: number; channels: number } }) {
  return (
    <section className="bg-stage text-stage-ink">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 pb-12 pt-10 sm:gap-8 sm:px-6 sm:pb-16 sm:pt-14">
        <p className="max-w-2xl text-base leading-relaxed text-stage-dim sm:text-lg">
          {stats.videos.toLocaleString()} talks from {stats.channels} Ethereum conferences and
          meetups, searchable by title, speaker, and every word said on stage.
        </p>
        <HomeSearchHero />
        <p className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[15px] text-stage-dim">
          <span>Popular</span>
          {STARTER_SEARCHES.map((q) => (
            <Link
              key={q}
              href={`/?q=${encodeURIComponent(q)}`}
              className="rounded-sm font-medium text-stage-ink underline decoration-stage-line decoration-2 underline-offset-[6px] transition-colors hover:decoration-peach"
            >
              {q}
            </Link>
          ))}
        </p>
      </div>
    </section>
  );
}
