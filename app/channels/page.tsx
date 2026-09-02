import Link from "next/link";
import type { Metadata } from "next";
import { getDirectory, type DirectoryEntry } from "@/lib/directory";
import { getOrganization, getOrgSessionCount } from "@/lib/data";
import { initials } from "@/lib/format";

export const metadata: Metadata = {
  title: "Channels — StreamETH Light",
};

function coverageLabel(entry: DirectoryEntry): string {
  if (entry.sessionCount > 0) {
    return `${entry.sessionCount} video${entry.sessionCount === 1 ? "" : "s"}`;
  }
  if (entry.youtubeVideoCount > 0) return `${entry.youtubeVideoCount} on YouTube`;
  if (entry.miraEventCount > 0) {
    return `${entry.miraEventCount} tracked event${entry.miraEventCount === 1 ? "" : "s"}`;
  }
  return "no video yet";
}

export default function ChannelsPage() {
  // directory.json's sessionCount is a point-in-time snapshot that goes
  // stale the moment sessions.json is re-exported — prefer the live count
  // for anything that maps to a real StreamETH org.
  const directory = getDirectory().map((entry) => {
    const org = getOrganization(entry.slug);
    return org ? { ...entry, sessionCount: getOrgSessionCount(org._id) } : entry;
  });

  const active = directory
    .filter((e) => e.sessionCount > 0 || e.youtubeVideoCount > 0 || e.miraEventCount > 0)
    .sort((a, b) => b.sessionCount + b.youtubeVideoCount - (a.sessionCount + a.youtubeVideoCount));
  const tracked = directory
    .filter((e) => !(e.sessionCount > 0 || e.youtubeVideoCount > 0 || e.miraEventCount > 0))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Channels</h1>
        <p className="max-w-2xl text-sm text-ink-dim">
          {active.length} channels with a video archive, plus {tracked.length} more
          Ethereum-ecosystem organizations and conferences tracked here.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {active.map((entry) => (
          <Link
            key={entry.slug}
            href={`/${entry.slug}`}
            className="group flex flex-col gap-3 rounded-lg border border-line p-4 hover:border-ink-faint"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-panel text-sm font-medium text-ink-dim">
              {initials(entry.name)}
            </div>
            <div>
              <h2 className="text-sm font-medium text-ink group-hover:text-white">
                {entry.name}
              </h2>
              <p className="text-xs text-ink-faint">{coverageLabel(entry)}</p>
            </div>
          </Link>
        ))}
      </div>

      {tracked.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <p className="text-xs uppercase tracking-wide text-ink-faint">
            Tracked — no video yet
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {tracked.map((entry) => (
              <Link
                key={entry.slug}
                href={`/${entry.slug}`}
                className="text-xs text-ink-faint hover:text-ink-dim"
              >
                {entry.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
