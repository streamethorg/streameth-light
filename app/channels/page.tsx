import Link from "next/link";
import { getDirectory, type DirectoryEntry } from "@/lib/directory";
import { getOrganization, getOrgSessionCount } from "@/lib/data";
import Avatar from "@/components/Avatar";
import PageHero from "@/components/PageHero";
import SectionHeader from "@/components/SectionHeader";
import { getLiveYoutubeVideoCount } from "@/lib/youtube";
import { buildMetadata } from "@/lib/social";

export const metadata = buildMetadata({
  title: "Channels — StreamETH",
  description: "Every organization and channel archived by StreamETH.",
  path: "/channels",
});

function coverageLabel(entry: DirectoryEntry): string {
  const videos = entry.sessionCount + entry.youtubeVideoCount;
  if (videos > 0) return `${videos.toLocaleString()} ${videos === 1 ? "video" : "videos"}`;
  if (entry.miraEventCount > 0) {
    return `${entry.miraEventCount} tracked ${entry.miraEventCount === 1 ? "event" : "events"}`;
  }
  return "No recordings yet";
}

export default function ChannelsPage() {
  // directory.json's sessionCount/youtubeVideoCount are point-in-time
  // snapshots that go stale the moment sessions.json is re-exported or a
  // channel is re-pulled (e.g. one entry stayed at "15" after a
  // full-coverage YouTube pull found 2,377 real uploads) — prefer live
  // counts computed from the actual current data.
  const directory = getDirectory().map((entry) => {
    const org = getOrganization(entry.slug);
    return {
      ...entry,
      sessionCount: org ? getOrgSessionCount(org._id) : entry.sessionCount,
      youtubeVideoCount: entry.youtubeChannel
        ? getLiveYoutubeVideoCount(entry.slug)
        : entry.youtubeVideoCount,
    };
  });

  const active = directory
    .filter((e) => e.sessionCount > 0 || e.youtubeVideoCount > 0 || e.miraEventCount > 0)
    .sort((a, b) => b.sessionCount + b.youtubeVideoCount - (a.sessionCount + a.youtubeVideoCount));
  const tracked = directory
    .filter((e) => !(e.sessionCount > 0 || e.youtubeVideoCount > 0 || e.miraEventCount > 0))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Channels"
        meta={`${active.length} with recordings • ${tracked.length} more tracked`}
      />

      <div className="flex flex-1 flex-col gap-10 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {active.map((entry) => (
            <Link
              key={entry.slug}
              href={`/${entry.slug}`}
              className="group flex flex-col items-center gap-3 rounded-xl p-2 text-center outline-offset-4"
            >
              <Avatar
                name={entry.name}
                channel
                className="h-24 w-24 text-2xl transition-transform duration-200 group-hover:scale-105 sm:h-32 sm:w-32 sm:text-3xl"
              />
              <div className="flex min-w-0 max-w-full flex-col gap-0.5">
                <h2 className="truncate text-base font-semibold text-ink">{entry.name}</h2>
                <p className="truncate text-xs text-ink-dim">
                  @{entry.slug} • {coverageLabel(entry)}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {tracked.length > 0 && (
          <div className="flex flex-col gap-5">
            <SectionHeader
              title="Tracked, not recorded yet"
              detail="Ethereum organizations and conferences we follow that don't have public talks here."
            />
            <div className="flex flex-wrap gap-2">
              {tracked.map((entry) => (
                <Link
                  key={entry.slug}
                  href={`/${entry.slug}`}
                  className="flex h-8 items-center rounded-lg bg-panel-raised px-3 text-sm font-medium text-ink transition-colors hover:bg-panel-hover"
                >
                  {entry.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
