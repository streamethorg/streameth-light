import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VideoCard from "@/components/VideoCard";
import { listTopics, getTopicBySlug, getTopicSessions } from "@/lib/topics";
import { getEventById } from "@/lib/data";

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
  return { title: `${topic.name} — StreamETH Light` };
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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <Link
        href="/topics"
        className="w-fit font-mono text-xs uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-dim"
      >
        ← All topics
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          {topic.name}
        </h1>
        <p className="font-mono text-xs tabular text-ink-faint">
          {String(sessions.length).padStart(2, "0")} sessions
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sessions.map((s) => (
          <VideoCard key={s._id} session={s} event={getEventById(s.eventId)} />
        ))}
      </div>
    </div>
  );
}
