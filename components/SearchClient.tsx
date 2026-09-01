"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface SearchResult {
  type: "session" | "youtube";
  id: string;
  name: string;
  eventName: string;
  coverImage: string | null;
  speakers: string[];
  topics: string[];
  score: number;
  matchedIn: string[];
  snippet: string | null;
  href: string;
}

const MATCH_LABEL: Record<string, string> = {
  title: "title",
  speaker: "speaker",
  topic: "topic",
  description: "description",
  transcript: "transcript",
};

function highlight(snippet: string, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return snippet;
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = snippet.split(pattern);
  return parts.map((part, i) =>
    terms.some((t) => part.toLowerCase() === t) ? (
      <mark key={i} className="rounded-sm bg-accent/25 text-ink">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function SearchClient() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(() => {
      if (q.length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(data.results ?? []);
          setSearched(true);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, speakers, topics, transcripts…"
          className="w-full rounded-md border border-line bg-panel px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none"
        />
        <p className="font-mono text-[11px] text-ink-faint">
          Searches StreamETH session titles, speakers, topics, and
          transcripts, plus titles/descriptions (and captions, where
          available) from tracked YouTube channels.
        </p>
      </div>

      {loading && (
        <p className="font-mono text-xs text-ink-faint">Searching…</p>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="py-12 text-center font-mono text-sm text-ink-faint">
          No results for &quot;{query}&quot;.
        </p>
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-6">
          {results.map((r) => {
            const inner = (
              <>
                <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md border border-line bg-panel sm:w-44">
                  {r.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.coverImage}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase text-ink-faint">
                      No preview
                    </div>
                  )}
                  <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-void/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink">
                    {r.type === "session" ? "StreamETH" : "YouTube"}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <h3 className="line-clamp-1 text-sm font-medium text-ink transition-colors group-hover:text-accent">
                    {r.name}
                  </h3>
                  <p className="font-mono text-[11px] text-ink-faint">
                    {r.eventName}
                    {r.speakers.length > 0 ? ` · ${r.speakers.join(", ")}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.matchedIn.map((m) => (
                      <span
                        key={m}
                        className="rounded-sm bg-panel-raised px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-faint"
                      >
                        {MATCH_LABEL[m] ?? m}
                      </span>
                    ))}
                  </div>
                  {r.snippet && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-ink-dim">
                      {highlight(r.snippet, query)}
                    </p>
                  )}
                </div>
              </>
            );

            return r.href.startsWith("/") ? (
              <Link
                key={r.id}
                href={r.href}
                className="group flex gap-4 border-b border-line pb-6 last:border-0"
              >
                {inner}
              </Link>
            ) : (
              <a
                key={r.id}
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="group flex gap-4 border-b border-line pb-6 last:border-0"
              >
                {inner}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
