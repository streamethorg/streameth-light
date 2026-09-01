import { Suspense } from "react";
import type { Metadata } from "next";
import SearchClient from "@/components/SearchClient";

export const metadata: Metadata = {
  title: "Search — StreamETH Light",
  description:
    "Search across every session's title, speakers, topics, and transcript.",
};

export default function SearchPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          <span className="on-air-dot h-1.5 w-1.5 rounded-full bg-accent" />
          full-text search
        </div>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          Search
        </h1>
      </div>
      <Suspense fallback={null}>
        <SearchClient />
      </Suspense>
    </div>
  );
}
