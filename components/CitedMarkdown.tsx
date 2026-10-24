import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { AskSource } from "@/lib/ask";
import { videoLinkWithQuery } from "@/lib/videoLink";

export interface ExternalCitation {
  n: number;
  url: string;
  title: string;
}

/** Some models write grouped citations ("[2, 3]"); split them into
 * "[2][3]" so each becomes its own link. */
export function splitGroupedCitations(text: string): string {
  return text.replace(/\[(w?\d+(?:\s*,\s*w?\d+)+)\]/g, (_, list: string) =>
    list
      .split(",")
      .map((n) => `[${n.trim()}]`)
      .join("")
  );
}

/** The opening words of a quote, as a find-in-transcript query for the
 * cited talk (transcripts are lowercase and unpunctuated). */
function quoteNeedle(quote: string): string {
  return quote
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
}

function firstQuote(text: string): string | null {
  const m = text.match(/["“]([^"”]{12,})["”]/);
  return m ? m[1] : null;
}

/** Just enough markdown for cited writing (Ask answers, stories):
 * paragraphs, "- " bullets, **bold**, [n] citations linking to the cited
 * talk, and [wN] citations linking to outside sources. With
 * `linkQuotes`, a citation in a paragraph that quotes the talk opens it
 * with the quote found in the transcript. */
export default function CitedMarkdown({
  text,
  sources,
  external,
  currentVideoId,
  linkQuotes = false,
  paragraphClassName,
}: {
  text: string;
  sources: Map<number, AskSource>;
  external?: Map<number, ExternalCitation>;
  currentVideoId?: string;
  linkQuotes?: boolean;
  paragraphClassName?: string;
}) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const inline = (line: string) => (
    <Inline
      text={line}
      sources={sources}
      external={external}
      currentVideoId={currentVideoId}
      quote={linkQuotes ? firstQuote(line) : null}
    />
  );
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-faint">
        {list.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flushList();
    if (!line) continue;
    blocks.push(
      <p key={`p-${blocks.length}`} className={paragraphClassName}>
        {inline(line.replace(/^#+\s*/, ""))}
      </p>
    );
  }
  flushList();
  return <>{blocks}</>;
}

const CITE_CLASS =
  "mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded-sm px-1 align-middle text-[11px] font-semibold tabular-nums no-underline";

function Inline({
  text,
  sources,
  external,
  currentVideoId,
  quote,
}: {
  text: string;
  sources: Map<number, AskSource>;
  external?: Map<number, ExternalCitation>;
  currentVideoId?: string;
  quote: string | null;
}) {
  const parts = splitGroupedCitations(text).split(/(\*\*[^*]+\*\*|\[w?\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <strong key={i} className="font-semibold">{bold[1]}</strong>;
        const ext = part.match(/^\[w(\d+)\]$/);
        if (ext) {
          const link = external?.get(Number(ext[1]));
          if (!link) return <Fragment key={i}>{part}</Fragment>;
          return (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noreferrer nofollow ugc"
              title={`${link.title} (outside link, not verified)`}
              className={`${CITE_CLASS} border border-dashed border-line text-ink-dim hover:border-accent hover:text-accent`}
            >
              ↗{ext[1]}
            </a>
          );
        }
        const cite = part.match(/^\[(\d+)\]$/);
        if (cite) {
          const source = sources.get(Number(cite[1]));
          if (!source) return <Fragment key={i}>{part}</Fragment>;
          // A passage of the talk being watched: show the quote on hover
          // rather than linking to the page we're already on.
          if (source.videoId === currentVideoId) {
            return (
              <span key={i} title={source.excerpt} className={`${CITE_CLASS} cursor-help bg-panel-raised text-ink-dim`}>
                {cite[1]}
              </span>
            );
          }
          const href = quote ? videoLinkWithQuery(source.watchUrl, quoteNeedle(quote)) : source.watchUrl;
          return (
            <Link
              key={i}
              href={href}
              title={`${source.title}${source.speakers.length ? ` — ${source.speakers.join(", ")}` : ""}`}
              className={`${CITE_CLASS} bg-accent/10 text-accent hover:bg-accent hover:text-accent-ink`}
            >
              {cite[1]}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
