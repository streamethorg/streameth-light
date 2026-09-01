import Link from "next/link";
import LibraryBrowser from "@/components/LibraryBrowser";
import { listAllSessions, listAllEvents } from "@/lib/data";

export default function VideosPage() {
  const sessions = listAllSessions();
  const events = listAllEvents();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit font-mono text-xs uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-dim"
        >
          ← Home
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          All videos
        </h1>
      </div>
      <LibraryBrowser sessions={sessions} events={events} />
    </div>
  );
}
