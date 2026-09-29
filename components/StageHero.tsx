import Link from "next/link";
import Avatar from "@/components/Avatar";
import CoverImage from "@/components/CoverImage";
import HomeSearchHero from "@/components/HomeSearchHero";
import { formatDateShort, formatTimecode } from "@/lib/format";
import type { UnifiedVideo } from "@/lib/videoDb";

// Real searches with hundreds of matching talks each (checked against the
// FTS index) — a starting point for people who don't know what to type.
const STARTER_SEARCHES = ["Account abstraction", "Zero knowledge", "MEV", "Restaking", "Stablecoins"];

/** The homepage's opening: the dark "stage" (same color as the header, so
 * they read as one surface) lit from below by the logo's purple→peach
 * gradient, with the search on the left and the newest talk on the right. */
export default function StageHero({
  featured,
  stats,
}: {
  featured?: UnifiedVideo;
  stats: { videos: number; channels: number };
}) {
  return (
    <section className="relative isolate overflow-hidden bg-stage text-stage-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -bottom-1/2 left-[-10%] h-[80%] w-[60%] rounded-full bg-accent/45 blur-[120px]" />
        <div className="absolute -bottom-1/2 right-[-5%] h-[70%] w-[50%] rounded-full bg-peach/30 blur-[120px]" />
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] items-center gap-12 px-4 pb-14 pt-10 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-16 lg:pb-20 lg:pt-16">
        <div className="flex flex-col gap-7">
          <h1 className="display max-w-[12ch] text-[clamp(2.6rem,5.4vw,5.25rem)]">
            Every talk from the Ethereum stage.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-stage-dim sm:text-lg">
            {stats.videos.toLocaleString()} recorded talks, panels and workshops from{" "}
            {stats.channels} conferences and meetups. Search by title, speaker, or anything
            said in the talk.
          </p>
          <div className="max-w-2xl">
            <HomeSearchHero />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-stage-dim">Try</span>
            {STARTER_SEARCHES.map((q) => (
              <Link
                key={q}
                href={`/?q=${encodeURIComponent(q)}`}
                className="rounded-full bg-white/[0.07] px-3.5 py-1.5 text-sm font-medium text-stage-ink ring-1 ring-inset ring-stage-line transition-colors hover:bg-white hover:text-stage"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>

        {featured && <FeaturedTalk video={featured} />}
      </div>

      <div className="brand-gradient h-[3px] w-full" />
    </section>
  );
}

function FeaturedTalk({ video }: { video: UnifiedVideo }) {
  return (
    <Link href={video.watchUrl} className="group flex flex-col gap-5 rounded-2xl">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-stage-raised shadow-[0_40px_100px_-30px_rgb(0_0_0/0.8)] ring-1 ring-stage-line">
        <CoverImage
          src={video.coverImage}
          label={video.title}
          loading="eager"
          className="transition duration-500 ease-out group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span className="absolute bottom-4 left-4 flex items-center gap-2.5 rounded-full bg-white py-2 pl-2.5 pr-4 text-sm font-semibold text-stage shadow-lg transition-colors group-hover:bg-peach">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stage text-white">
            <svg viewBox="0 0 20 20" fill="currentColor" className="ml-0.5 h-3.5 w-3.5">
              <path d="M6.3 3.2A1 1 0 004.8 4v12a1 1 0 001.5.87l10-6a1 1 0 000-1.74l-10-6z" />
            </svg>
          </span>
          Watch
          {video.durationSeconds !== null && (
            <span className="tabular font-medium text-ink-faint">
              {formatTimecode(video.durationSeconds)}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-start gap-3.5">
        <Avatar
          name={video.orgName}
          photo={video.orgLogo}
          shape="square"
          className="h-11 w-11 text-sm"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-stage-dim">
            Newest from <span className="font-semibold text-stage-ink">{video.orgName}</span>
            {video.publishedAt ? `, ${formatDateShort(video.publishedAt)}` : ""}
          </p>
          <h2 className="line-clamp-2 text-xl font-bold leading-snug tracking-[-0.02em] text-stage-ink transition-colors group-hover:text-peach sm:text-2xl">
            {video.title}
          </h2>
        </div>
      </div>
    </Link>
  );
}
