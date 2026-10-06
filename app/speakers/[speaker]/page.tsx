import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VideoCard from "@/components/VideoCard";
import Avatar from "@/components/Avatar";
import PageHero, { HeroLink } from "@/components/PageHero";
import SectionHeader from "@/components/SectionHeader";
import { listSpeakers, getSpeakerBySlug, getSpeakerSessions } from "@/lib/people";
import { getEventById, getOrgForEvent } from "@/lib/data";
import { buildMetadata } from "@/lib/social";
import { speakerJsonLd, truncate } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

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
  return buildMetadata({
    title: `${speaker.name} — Talks — StreamETH`,
    description: truncate(
      speaker.bio ||
        `${speaker.sessionIds.length} ${speaker.sessionIds.length === 1 ? "talk" : "talks"} by ${speaker.name}${speaker.company ? ` (${speaker.company})` : ""} at Ethereum conferences.`,
      200
    ),
    image: speaker.photo,
    path: `/speakers/${speaker.slug}`,
    type: "profile",
  });
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
      <JsonLd
        data={speakerJsonLd({
          name: speaker.name,
          path: `/speakers/${speaker.slug}`,
          bio: speaker.bio,
          photo: speaker.photo,
          company: speaker.company,
          twitter: twitterHandle,
        })}
      />
      <PageHero
        back={{ href: "/speakers", label: "All speakers" }}
        leading={
          <Avatar
            name={speaker.name}
            photo={speaker.photo}
            className="h-16 w-16 text-xl sm:h-32 sm:w-32 sm:text-4xl"
          />
        }
        title={speaker.name}
        meta={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {speaker.company && <span className="font-medium text-ink">{speaker.company}</span>}
            <span>
              {sessions.length} {sessions.length === 1 ? "talk" : "talks"}
            </span>
          </span>
        }
        description={speaker.bio && <p className="whitespace-pre-line">{speaker.bio}</p>}
        actions={twitterHandle && <HeroLink href={`https://x.com/${twitterHandle}`}>@{twitterHandle}</HeroLink>}
      />

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <SectionHeader title="Talks" />
        <div className="grid grid-cols-1 gap-x-4 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {sessions.map((s) => {
            const event = getEventById(s.eventId);
            return <VideoCard key={s._id} session={s} event={event} org={getOrgForEvent(event)} />;
          })}
        </div>
      </div>
    </div>
  );
}
