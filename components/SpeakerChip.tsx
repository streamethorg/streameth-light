import Link from "next/link";
import type { SessionSpeaker } from "@/lib/types";
import { initials } from "@/lib/format";
import { findSpeakerSlugForName } from "@/lib/people";

export default function SpeakerChip({ speaker }: { speaker: SessionSpeaker }) {
  const slug = findSpeakerSlugForName(speaker.name);

  const content = (
    <>
      {speaker.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={speaker.photo}
          alt=""
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-panel-raised font-mono text-[11px] text-ink-dim">
          {initials(speaker.name)}
        </div>
      )}
      <span className="flex flex-col leading-tight">
        <span className="text-sm text-ink">{speaker.name}</span>
        {speaker.company && (
          <span className="font-mono text-[11px] text-ink-faint">
            {speaker.company}
          </span>
        )}
      </span>
    </>
  );

  if (slug) {
    return (
      <Link
        href={`/speakers/${slug}`}
        className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        {content}
      </Link>
    );
  }

  const twitterHandle = speaker.twitter?.trim().replace(/^@/, "");
  const href = twitterHandle
    ? `https://x.com/${twitterHandle}`
    : speaker.website || undefined;

  if (!href) {
    return <div className="flex items-center gap-2.5">{content}</div>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
    >
      {content}
    </a>
  );
}
