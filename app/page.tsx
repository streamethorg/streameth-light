import Link from "next/link";
import ChannelBrowser from "@/components/ChannelBrowser";
import SignalMeter from "@/components/SignalMeter";
import { getDirectory } from "@/lib/directory";
import { getOrganization, getOrgSessionCount } from "@/lib/data";

export default function Home() {
  // directory.json's sessionCount is a generated-at-a-point-in-time snapshot
  // and goes stale the moment sessions.json is re-exported (e.g. widening
  // the DB filter to include private sessions) — for any entry that maps to
  // a real StreamETH org, prefer the live count so channels with content
  // never show as empty just because the snapshot predates the latest export.
  const directory = getDirectory().map((entry) => {
    const org = getOrganization(entry.slug);
    return org ? { ...entry, sessionCount: getOrgSessionCount(org._id) } : entry;
  });
  const totalVideos = directory.reduce((sum, e) => sum + e.sessionCount, 0);
  const withVideo = directory.filter((e) => e.sessionCount > 0).length;

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative overflow-hidden border-b border-line">
        <div className="grain-overlay" />
        <div className="absolute inset-y-0 right-0 hidden w-64 opacity-[0.14] lg:block">
          <SignalMeter />
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-96 bg-gradient-to-l from-void via-void/60 to-transparent lg:block" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-24">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
            <span className="on-air-dot h-1.5 w-1.5 rounded-full bg-accent" />
            read-only archive
          </div>
          <h1 className="max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Every talk, and every channel, from the{" "}
            <span className="text-accent">Ethereum</span> events world.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-ink-dim">
            {totalVideos.toLocaleString()} public sessions playable now,
            across {withVideo} channels — plus {directory.length - withVideo}{" "}
            more Ethereum-ecosystem organizations and conferences tracked
            here, video archive or not.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/videos"
              className="rounded-sm bg-accent px-4 py-2 font-mono text-xs font-medium uppercase tracking-wide text-accent-ink transition-opacity hover:opacity-90"
            >
              Browse all videos →
            </Link>
            <span className="font-mono text-xs text-ink-faint">
              or pick a channel below
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-12 sm:px-6">
        <ChannelBrowser directory={directory} />
      </section>
    </div>
  );
}
