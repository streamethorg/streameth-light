import Link from "next/link";
import type { Metadata } from "next";
import { getDirectory, type DirectoryEntry } from "@/lib/directory";
import { getOrganization, getOrgSessionCount } from "@/lib/data";
import Avatar from "@/components/Avatar";
import CoverImage from "@/components/CoverImage";
import PageHero from "@/components/PageHero";
import SectionHeader from "@/components/SectionHeader";
import { latestCoverByChannel } from "@/lib/videoDb";
import { getLiveYoutubeVideoCount } from "@/lib/youtube";

export const metadata: Metadata = {
  title: "Channels — StreamETH",
};

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

  const covers = latestCoverByChannel();

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Channels"
        width="max-w-[1600px]"
        meta={`${active.length} with recordings, ${tracked.length} more tracked`}
        description="Every conference, meetup and community with talks in the archive, biggest first."
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-14 px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {active.map((entry) => {
            const cover = covers.get(entry.slug);
            return (
              <Link key={entry.slug} href={`/${entry.slug}`} className="group flex flex-col gap-3 rounded-xl outline-offset-4">
                <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-stage">
                  <CoverImage
                    src={cover}
                    label={entry.name}
                    className="opacity-90 transition duration-500 ease-out group-hover:scale-[1.04] group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stage/80 via-transparent to-transparent" />
                  <span className="brand-gradient absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  <Avatar
                    name={entry.name}
                    shape="square"
                    className="absolute bottom-3 left-3 h-12 w-12 text-sm shadow-lg"
                  />
                </div>
                <div className="flex min-w-0 flex-col">
                  <h2 className="truncate text-base font-bold tracking-[-0.01em] text-ink transition-colors group-hover:text-accent">
                    {entry.name}
                  </h2>
                  <p className="text-sm text-ink-faint">{coverageLabel(entry)}</p>
                </div>
              </Link>
            );
          })}
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
                  className="rounded-full bg-panel px-3.5 py-1.5 text-sm font-medium text-ink-dim ring-1 ring-line transition-colors hover:bg-stage hover:text-stage-ink hover:ring-stage"
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
