"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CoverImage from "./CoverImage";
import { mediaLabel, playerFor } from "@/lib/embedCore.mjs";

export interface EmbedItemData {
  id: string;
  provider: string;
  externalId: string | null;
  url: string;
  variant: string | null;
  title: string;
  description: string;
  authorName: string | null;
  authorUrl: string | null;
  siteName: string | null;
  imageUrl: string | null;
  note: string;
  reporter: { name: string; slug: string };
}

const ASPECT = {
  video: "aspect-video w-full",
  vertical: "aspect-[9/16] w-full max-w-[20rem]",
  audio: "h-[152px] w-full",
  "audio-tall": "h-[352px] w-full",
} as const;

/** A link a reporter added to the feed. Providers' players load only when
 * clicked — no third-party script or iframe until the reader asks for it —
 * except X posts, which X renders from our own quote once scrolled near.
 * Anything else is a link card. */
export default function EmbedItem({ embed }: { embed: EmbedItemData }) {
  return (
    <article className="flex flex-col gap-3">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-dim">
        {mediaLabel(embed.provider, embed.variant)}
        <span className="font-normal normal-case tracking-normal text-ink-faint">
          {" "}
          · shared by{" "}
          <Link href={`/reporters/${embed.reporter.slug}`} className="hover:text-ink hover:underline">
            {embed.reporter.name}
          </Link>
        </span>
      </p>
      {embed.note && <p className="text-[15px] leading-6 text-ink">{embed.note}</p>}
      {embed.provider === "x" ? <XPost embed={embed} /> : playerFor(embed) ? <Player embed={embed} /> : <LinkCard embed={embed} />}
    </article>
  );
}

function Byline({ embed }: { embed: EmbedItemData }) {
  const by = embed.authorName ?? embed.siteName;
  if (!by) return null;
  return embed.authorUrl ? (
    <a href={embed.authorUrl} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
      {by}
    </a>
  ) : (
    <span>{by}</span>
  );
}

/** Cover and title until clicked, then the provider's own player in place. */
function Player({ embed }: { embed: EmbedItemData }) {
  const [playing, setPlaying] = useState(false);
  const player = playerFor(embed)!;
  const box = ASPECT[player.aspect];
  const audio = player.aspect === "audio" || player.aspect === "audio-tall";

  return (
    <div className="flex flex-col gap-2">
      {playing ? (
        <div className={`${box} overflow-hidden rounded-sm bg-black`}>
          <iframe
            src={player.src}
            title={embed.title || mediaLabel(embed.provider, embed.variant)}
            className="h-full w-full"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${embed.title || mediaLabel(embed.provider, embed.variant)}`}
          className={`group relative overflow-hidden rounded-sm border border-line bg-panel-raised text-left ${
            audio ? "flex h-24 w-full items-center gap-4 p-3" : box
          }`}
        >
          {audio ? (
            <>
              <span className="relative block aspect-square h-full shrink-0 overflow-hidden rounded-sm bg-panel">
                <CoverImage src={embed.imageUrl} label={embed.title} />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="line-clamp-2 text-[15px] font-semibold leading-5 text-ink">{embed.title}</span>
                <span className="text-[13px] text-ink-dim">Play on {embed.siteName ?? "the provider"}</span>
              </span>
            </>
          ) : (
            <>
              <CoverImage src={embed.imageUrl} label={embed.title} />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white transition-transform group-hover:scale-105">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-6 w-6" aria-hidden="true">
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                </span>
              </span>
            </>
          )}
        </button>
      )}
      {!audio && (
        <div className="flex min-w-0 flex-col gap-0.5">
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 text-[15px] font-semibold leading-5 text-ink hover:text-ink-dim"
          >
            {embed.title}
          </a>
          <p className="text-[13px] text-ink-faint">
            <Byline embed={embed} />
          </p>
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    twttr?: { widgets?: { load: (el?: Element) => void } };
  }
}

let widgetsScript: Promise<void> | null = null;

/** X's embed script, added once per page. */
function loadWidgets(): Promise<void> {
  if (widgetsScript) return widgetsScript;
  widgetsScript = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      widgetsScript = null;
      reject(new Error("widgets.js failed to load"));
    };
    document.head.appendChild(script);
  });
  return widgetsScript;
}

/** Our own quote of the post (author, text, link) — what readers see until
 * X's script turns it into the real post when it's scrolled near, and what
 * stays if X is blocked. */
function XPost({ embed }: { embed: EmbedItemData }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        loadWidgets()
          .then(() => window.twttr?.widgets?.load(el))
          .catch(() => {
            // Blocked or offline: the quote below stays.
          });
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="max-w-[550px]">
      <blockquote className="twitter-tweet" data-dnt="true" data-conversation="none">
        <div className="flex flex-col gap-2 rounded-sm border border-line p-4">
          <p className="text-[13px] text-ink-dim">
            <Byline embed={embed} />
          </p>
          {embed.description && <p className="whitespace-pre-line text-[15px] leading-6 text-ink">{embed.description}</p>}
          <a href={embed.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent hover:underline">
            View on X ↗
          </a>
        </div>
      </blockquote>
    </div>
  );
}

/** Any other page: its picture, site, title and description, opening the
 * page in a new tab. */
function LinkCard({ embed }: { embed: EmbedItemData }) {
  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group grid grid-cols-1 overflow-hidden rounded-sm border border-line transition-colors hover:border-line-strong sm:grid-cols-[12rem_minmax(0,1fr)]"
    >
      {embed.imageUrl && (
        <div className="relative aspect-video bg-panel-raised sm:aspect-auto sm:h-full">
          <CoverImage src={embed.imageUrl} label={embed.title} />
        </div>
      )}
      <div className={`flex min-w-0 flex-col gap-1 p-3 ${embed.imageUrl ? "" : "sm:col-span-2"}`}>
        <p className="truncate text-[13px] text-ink-faint">{embed.siteName ?? new URL(embed.url).hostname}</p>
        <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-ink group-hover:text-ink-dim">{embed.title}</p>
        {embed.description && <p className="line-clamp-2 text-[13px] leading-5 text-ink-dim">{embed.description}</p>}
      </div>
    </a>
  );
}
