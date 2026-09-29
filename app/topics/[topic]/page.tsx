import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PageHero, { HeroLink } from "@/components/PageHero";
import VideoCard from "@/components/VideoCard";
import { listTopics, getTopicBySlug, getTopicSessions } from "@/lib/topics";
import { getEventById, getOrgForEvent } from "@/lib/data";

export function generateStaticParams() {
  return listTopics().map((t) => ({ topic: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic: slug } = await params;
  const topic = getTopicBySlug(slug);
  if (!topic) return {};
  return { title: `${topic.name} — StreamETH` };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic: slug } = await params;
  const topic = getTopicBySlug(slug);
  if (!topic) notFound();

  const sessions = getTopicSessions(topic);

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        back={{ href: "/topics", label: "All topics" }}
        title={topic.name}
        meta={`${sessions.length} ${sessions.length === 1 ? "talk" : "talks"}`}
        actions={
          <HeroLink href={`/?topic=${encodeURIComponent(topic.name)}`}>
            Search within this topic
          </HeroLink>
        }
      />
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid grid-cols-1 gap-x-5 gap-y-10 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {sessions.map((s) => {
            const event = getEventById(s.eventId);
            return <VideoCard key={s._id} session={s} event={event} org={getOrgForEvent(event)} />;
          })}
        </div>
      </div>
    </div>
  );
}
