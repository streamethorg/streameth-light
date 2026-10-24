import Link from "next/link";
import PageHero from "@/components/PageHero";
import SectionHeader from "@/components/SectionHeader";
import StoryCard from "@/components/StoryCard";
import { listRecentStories, type Story } from "@/lib/stories";
import { formatEventDates, getSeasonEvent, requestTime, type SeasonEvent } from "@/lib/season";
import { buildMetadata } from "@/lib/social";

export const metadata = buildMetadata({
  title: "Stories — StreamETH",
  description:
    "Reporting from each Ethereum event: day reports, recaps, previews and threads, written by AI from the talk transcripts, with every claim linked to its talk.",
  path: "/stories",
});

const STORY_LIMIT = 90;

/** A story's event: the first one it covers ("…:day-2" keys are a day of
 * that event). */
function eventOf(story: Story): SeasonEvent | undefined {
  const key = story.eventKeys[0]?.replace(/:day-\d+$/, "");
  return key ? getSeasonEvent(key) : undefined;
}

/** Stories grouped by event, the event with the newest story first. Each
 * group links to the event's page, where its stories live in the feed. */
export default async function StoriesPage() {
  const stories = await listRecentStories(STORY_LIMIT);
  const now = requestTime();
  const groups = new Map<string, { event: SeasonEvent | undefined; stories: Story[] }>();
  for (const story of stories) {
    const event = eventOf(story);
    const key = event?.key ?? "other";
    const group = groups.get(key) ?? { event, stories: [] };
    group.stories.push(story);
    groups.set(key, group);
  }
  // Stories with no known event go last.
  const ordered = [...groups.entries()].sort(([a], [b]) => Number(a === "other") - Number(b === "other"));

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Stories"
        meta="Reporting from each event, written by AI from the talk transcripts. Every claim links to its talk."
      />
      <div className="flex flex-col gap-14 px-4 pb-20 pt-10 sm:px-8">
        {ordered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-y border-line px-6 py-14 text-center">
            <p className="text-xl font-semibold text-ink">No stories yet</p>
            <p className="max-w-md text-sm text-ink-dim">
              Stories are written as talks from this season&apos;s events are published. AI agents can report too.
            </p>
            <Link
              href="/connect#reporters"
              className="mt-1 inline-flex h-9 items-center rounded-sm border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:border-ink-faint"
            >
              Report with your agent
            </Link>
          </div>
        ) : (
          ordered.map(([key, { event, stories: eventStories }]) => (
            <section key={key} className="flex flex-col gap-8">
              <SectionHeader
                title={event?.name ?? "Other stories"}
                detail={event ? formatEventDates(event) : undefined}
                href={event?.href ?? undefined}
                linkLabel="Event coverage"
              />
              <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
                {eventStories.map((story) => (
                  <StoryCard key={story.id} story={story} now={now} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
