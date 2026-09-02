import Link from "next/link";
import type { SessionSpeaker } from "@/lib/types";
import { initials } from "@/lib/format";
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
    <Link href={`/speakers/${slug}`} className="font-medium text-ink hover:text-accent">
      {speaker.name}
    </Link>
  ) : (
    <span className="font-medium text-ink">{speaker.name}</span>
  );

  return (
    <div className="flex gap-3 rounded-md border border-line bg-panel p-4">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-panel-raised text-sm font-medium text-ink-dim">
          {initials(speaker.name)}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="text-sm">{nameEl}</div>
        {company && <p className="text-xs text-ink-faint">{company}</p>}
        {bio && <p className="line-clamp-3 text-xs leading-relaxed text-ink-dim">{bio}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {twitterHandle && (
            <a
              href={`https://x.com/${twitterHandle}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-ink-faint hover:text-ink"
            >
              X / Twitter
            </a>
          )}
          {speaker.github && (
            <a
              href={`https://github.com/${speaker.github.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-ink-faint hover:text-ink"
            >
              GitHub
            </a>
          )}
          {speaker.website && (
            <a
              href={speaker.website}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-ink-faint hover:text-ink"
            >
              Website
            </a>
          )}
          {slug && talkCount > 1 && (
            <Link href={`/speakers/${slug}`} className="text-xs text-ink-faint hover:text-ink">
              {talkCount} talks →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
