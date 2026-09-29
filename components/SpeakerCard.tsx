import Link from "next/link";
import type { SessionSpeaker } from "@/lib/types";
import Avatar from "@/components/Avatar";
import { findSpeakerSlugForName, getSpeakerBySlug, getSpeakerSessions } from "@/lib/people";

export default function SpeakerCard({ speaker }: { speaker: SessionSpeaker }) {
  const slug = findSpeakerSlugForName(speaker.name);
  const full = slug ? getSpeakerBySlug(slug) : undefined;

  const photo = full?.photo || speaker.photo;
  const bio = full?.bio || speaker.bio;
  const company = full?.company || speaker.company;
  const twitterHandle = (full?.twitter || speaker.twitter)?.trim().replace(/^@/, "");
  const talkCount = full ? getSpeakerSessions(full).length : 1;

  const nameEl = slug ? (
    <Link href={`/speakers/${slug}`} className="rounded-sm font-semibold text-ink hover:text-accent">
      {speaker.name}
    </Link>
  ) : (
    <span className="font-semibold text-ink">{speaker.name}</span>
  );

  return (
    <div className="flex gap-4 rounded-2xl bg-panel p-5 ring-1 ring-line">
      <Avatar name={speaker.name} photo={photo} className="h-16 w-16 shrink-0 text-base" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-col">
          <div className="text-base leading-tight">{nameEl}</div>
          {company && <p className="text-sm text-ink-faint">{company}</p>}
        </div>
        {bio && <p className="line-clamp-3 text-sm leading-relaxed text-ink-dim">{bio}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          {twitterHandle && (
            <a
              href={`https://x.com/${twitterHandle}`}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-medium text-ink-faint hover:text-accent"
            >
              X / Twitter
            </a>
          )}
          {speaker.github && (
            <a
              href={`https://github.com/${speaker.github.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-medium text-ink-faint hover:text-accent"
            >
              GitHub
            </a>
          )}
          {speaker.website && (
            <a
              href={speaker.website}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-medium text-ink-faint hover:text-accent"
            >
              Website
            </a>
          )}
          {slug && talkCount > 1 && (
            <Link href={`/speakers/${slug}`} className="text-[13px] font-semibold text-accent hover:underline">
              All {talkCount} talks
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
