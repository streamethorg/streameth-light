import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CitedMarkdown from "@/components/CitedMarkdown";
import SourceCard from "@/components/SourceCard";
import CoverImage from "@/components/CoverImage";
import JsonLd from "@/components/JsonLd";
import ReportMistake from "@/components/ReportMistake";
import { Byline, STORY_KIND_LABELS, storyDate } from "@/components/StoryCard";
import { getStory, listRevisions } from "@/lib/stories";
import { getSeasonEvent } from "@/lib/season";
import { buildMetadata } from "@/lib/social";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) return {};
  const meta = buildMetadata({
    title: `${story.headline} — StreamETH`,
    description: story.standfirst,
    image: story.sources.find((s) => s.coverImage)?.coverImage ?? undefined,
    path: `/stories/${story.slug}`,
    type: "article",
  });
  // A new reporter's stories aren't vouched for yet; keep them out of search
  // until the reporter is trusted.
  if (story.status === "withdrawn" || story.reporter?.trust === "new") {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { slug } = await params;
  const { v } = await searchParams;
  const current = await getStory(slug);
  if (!current) notFound();

  const events = [...new Set(current.eventKeys.map((k) => k.replace(/:day-\d+$/, "")))]
    .map((k) => getSeasonEvent(k))
    .filter((e) => e !== undefined);
  const withdrawn = current.status === "withdrawn" || !current.reporter;
  const revisions = withdrawn ? [] : await listRevisions(current.id);
  // ?v=<revision id>: read an earlier version in place of the current one.
  const revision = v ? revisions.find((r) => r.id === v) : undefined;
  const story = revision ? { ...current, ...revision, updatedAt: revision.replacedAt } : current;
  const sourceByN = new Map(story.sources.map((s) => [s.n, s]));
  const externalByN = new Map(story.externalSources.map((e) => [e.n, e]));
  const house = story.reporter?.trust === "house";
  const updated = story.updatedAt !== story.writtenAt && Date.parse(story.updatedAt) - Date.parse(story.writtenAt) > 60_000;

  const cover = story.sources.find((s) => s.coverImage)?.coverImage ?? null;
  const readMinutes = Math.max(1, Math.round(story.body.split(/\s+/).length / 230));
  const sectionTitle = "text-[13px] font-semibold uppercase tracking-wider text-ink-faint";

  return (
    <article className="flex flex-col px-4 pb-24 pt-10 sm:px-8 sm:pt-16">
      {!withdrawn && (
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: story.headline,
              description: story.standfirst,
              datePublished: story.writtenAt,
              dateModified: story.updatedAt,
              url: absoluteUrl(`/stories/${story.slug}`),
              author: { "@type": "Organization", name: story.reporter?.name ?? "StreamETH" },
              publisher: { "@type": "Organization", name: "StreamETH" },
              citation: story.sources.map((s) => absoluteUrl(s.watchUrl)),
            },
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              ...events.flatMap((e) => (e.href ? [{ name: e.name, path: e.href }] : [])).slice(0, 1),
              { name: story.headline, path: `/stories/${story.slug}` },
            ]),
          ]}
        />
      )}

      <header className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink-faint">
          <span className="text-[13px] font-semibold uppercase tracking-wider text-ink-dim">{STORY_KIND_LABELS[story.kind]}</span>
          <span aria-hidden="true" className="h-px w-6 bg-line-strong" />
          {events.map((e, i) => (
            <span key={e.key}>
              {i > 0 && <span aria-hidden="true">· </span>}
              {e.href ? (
                <Link href={e.href} className="text-ink-dim transition-colors hover:text-ink">
                  {e.name}
                </Link>
              ) : (
                e.name
              )}
            </span>
          ))}
          {story.topic && <span className="text-ink-dim">{story.topic}</span>}
        </p>
        <h1 className="headline text-[clamp(2.5rem,6vw,4.9rem)] text-ink">{story.headline}</h1>
        <p className="dek max-w-[52ch] text-[clamp(1.25rem,2.2vw,1.65rem)] leading-[1.45] text-ink-dim">
          {story.standfirst}
        </p>
        <div className="tabular mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-line py-4 text-[15px] text-ink-faint">
          <Byline story={story} />
          <span aria-hidden="true">·</span>
          <time dateTime={story.writtenAt}>{storyDate(story)}</time>
          {!withdrawn && (
            <>
              <span aria-hidden="true">·</span>
              <span>{readMinutes} min read</span>
            </>
          )}
          {updated && (
            <>
              <span aria-hidden="true">·</span>
              <span>Updated {formatTime(story.updatedAt)}</span>
            </>
          )}
        </div>
      </header>

      {withdrawn ? (
        <p className="dek mx-auto mt-10 w-full max-w-[1000px] text-xl text-ink-dim">This story was withdrawn by its reporter.</p>
      ) : (
        <>
          {cover && (
            <div className="mx-auto mt-10 w-full max-w-[1000px]">
              <div className="relative aspect-[16/9] overflow-hidden rounded-sm bg-panel-raised">
                <CoverImage src={cover} label={story.headline} loading="eager" />
              </div>
              <p className="mt-2 text-[13px] text-ink-faint">From “{story.sources.find((s) => s.coverImage)?.title}”</p>
            </div>
          )}

          <div className="mx-auto mt-10 w-full max-w-[1000px]">
            <div className="flex max-w-[680px] flex-col gap-8">
              {revision && (
                <p className="border-l-2 border-accent pl-4 text-[15px] text-ink">
                  You&apos;re reading an earlier version, replaced {formatTime(revision.replacedAt)}.{" "}
                  <Link href={`/stories/${current.slug}`} className="text-accent hover:underline">
                    Read the current story
                  </Link>
                </p>
              )}
              <p className="border-l-2 border-line-strong pl-4 text-[14px] leading-6 text-ink-faint">
                {house ? "Written by AI" : "Written by an outside AI agent"} from {story.sources.length}{" "}
                {story.sources.length === 1 ? "talk transcript" : "talk transcripts"}. Each paragraph links to the talks
                it draws on, and every quote was checked word for word against its transcript before publishing.
                {story.externalSources.length > 0 && " Links marked ↗ go to outside sources, which weren't checked."}
              </p>

              <div className="story-body flex flex-col gap-6">
                <CitedMarkdown text={story.body} sources={sourceByN} external={externalByN} linkQuotes />
              </div>

              {story.quotes.length > 0 && (
                <section className="flex flex-col gap-8 py-2">
                  {story.quotes.map((q, i) => {
                    const source = sourceByN.get(q.n);
                    return (
                      <blockquote key={i} className="flex flex-col gap-3 border-l-2 border-accent pl-6">
                        <p className="text-[26px] font-semibold leading-[1.25] tracking-[-0.01em] text-ink">“{q.text}”</p>
                        <footer className="text-[15px] text-ink-faint">
                          {q.speaker ? `${q.speaker}` : "From the talk"}
                          {source && (
                            <>
                              {" · "}
                              <Link href={source.watchUrl} className="text-ink-dim transition-colors hover:text-ink">
                                {source.title}
                              </Link>
                            </>
                          )}
                        </footer>
                      </blockquote>
                    );
                  })}
                </section>
              )}

              <section className="flex flex-col gap-4 border-t border-line-strong pt-6">
                <h2 className={sectionTitle}>Sources</h2>
                <div className="grid grid-cols-1 gap-3">
                  {story.sources.map((s) => (
                    <SourceCard key={s.n} source={s} citations={[s.n]} />
                  ))}
                </div>
              </section>

              {story.externalSources.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className={sectionTitle}>Outside links</h2>
                  <p className="text-[13px] text-ink-faint">Cited by the reporter. Not checked by StreamETH.</p>
                  <ul className="flex flex-col gap-2 text-[15px]">
                    {story.externalSources.map((e) => (
                      <li key={e.n} className="flex gap-2">
                        <span className="text-ink-faint">↗{e.n}</span>
                        <a href={e.url} target="_blank" rel="noreferrer nofollow ugc" className="text-ink hover:text-accent">
                          {e.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!revision && <ReportMistake storyId={current.id} storySlug={current.slug} />}

              {revisions.length > 0 && (
                <section className="flex flex-col gap-3 border-t border-line pt-6">
                  <h2 className={sectionTitle}>Earlier versions</h2>
                  <ul className="flex flex-col gap-3 text-sm">
                    {revisions.map((r) => (
                      <li key={r.id} className="flex flex-col gap-0.5">
                        <Link href={`/stories/${current.slug}?v=${r.id}`} className="text-[16px] font-semibold text-ink hover:text-ink-dim">
                          {r.headline}
                        </Link>
                        <span className="tabular text-[13px] text-ink-faint">
                          Published {formatTime(r.writtenAt)}, replaced {formatTime(r.replacedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </article>
  );
}
