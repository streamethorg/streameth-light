import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VideoCard from "@/components/VideoCard";
import Avatar from "@/components/Avatar";
import PageHero, { HeroLink } from "@/components/PageHero";
import SectionHeader from "@/components/SectionHeader";
import { listSpeakers, getSpeakerBySlug, getSpeakerSessions } from "@/lib/people";
import { getEventById, getOrgForEvent } from "@/lib/data";

export function generateStaticParams() {
  return listSpeakers().map((sp) => ({ speaker: sp.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ speaker: string }>;
}): Promise<Metadata> {
  const { speaker: slug } = await params;
  const speaker = getSpeakerBySlug(slug);
  if (!speaker) return {};
  return {
    title: `${speaker.name} — StreamETH`,
    description: speaker.bio?.slice(0, 200),
  };
}

export default async function SpeakerPage({
  params,
}: {
  params: Promise<{ speaker: string }>;
}) {
  const { speaker: slug } = await params;
  const speaker = getSpeakerBySlug(slug);
  if (!speaker) notFound();

  const sessions = getSpeakerSessions(speaker);
  const twitterHandle = speaker.twitter?.trim().replace(/^@/, "");

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        back={{ href: "/speakers", label: "All speakers" }}
        leading={
          <Avatar
            name={speaker.name}
            photo={speaker.photo}
            className="h-24 w-24 text-2xl ring-4 ring-white/10 sm:h-28 sm:w-28"
          />
        }
        title={speaker.name}
        meta={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {speaker.company && <span className="text-stage-ink">{speaker.company}</span>}
            <span>
              {sessions.length} {sessions.length === 1 ? "talk" : "talks"}
            </span>
          </span>
        }
        description={speaker.bio && <p className="whitespace-pre-line">{speaker.bio}</p>}
        actions={twitterHandle && <HeroLink href={`https://x.com/${twitterHandle}`}>@{twitterHandle}</HeroLink>}
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
        <SectionHeader title="Talks" />
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
