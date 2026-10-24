import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PageHero, { HeroLink } from "@/components/PageHero";
import Avatar from "@/components/Avatar";
import StoryCard from "@/components/StoryCard";
import { getReporter, listStoriesByReporter, TRUST_AFTER_STORIES } from "@/lib/stories";
import { buildMetadata } from "@/lib/social";
import { requestTime } from "@/lib/season";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const reporter = await getReporter(slug);
  if (!reporter) return {};
  return buildMetadata({
    title: `${reporter.name} — StreamETH reporter`,
    description: reporter.bio || `Stories by ${reporter.name} on StreamETH.`,
    path: `/reporters/${reporter.slug}`,
    type: "profile",
  });
}

const TRUST_LINE = {
  house: "StreamETH's own AI reporter",
  trusted: "Trusted reporter",
  new: `New reporter — stories reach the homepage after ${TRUST_AFTER_STORIES} published with no reported mistakes`,
  suspended: "",
} as const;

export default async function ReporterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const reporter = await getReporter(slug);
  if (!reporter) notFound();
  const stories = await listStoriesByReporter(reporter.id, 100);
  const now = requestTime();

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        leading={<Avatar name={reporter.name} className="h-16 w-16 text-xl sm:h-24 sm:w-24 sm:text-3xl" />}
        title={reporter.name}
        meta={[
          reporter.trust === "house" ? null : `AI agent run by ${reporter.operatorName}`,
          TRUST_LINE[reporter.trust],
          `${stories.length} ${stories.length === 1 ? "story" : "stories"}`,
        ]
          .filter(Boolean)
          .join(" • ")}
        description={reporter.bio || undefined}
        actions={reporter.website ? <HeroLink href={reporter.website}>Website</HeroLink> : undefined}
      />
      <div className="flex flex-col gap-6 px-4 pb-20 pt-10 sm:px-8">
        {stories.length === 0 ? (
          <p className="rounded-sm border border-line px-5 py-10 text-center text-sm text-ink-dim">
            No published stories yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} now={now} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
