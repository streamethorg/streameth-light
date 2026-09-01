import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrganization } from "@/lib/data";
import { getDirectory, getDirectoryEntry } from "@/lib/directory";
import {
  getInferredEventGroup,
  getYoutubeVideosForChannel,
  groupVideosByInferredEvent,
} from "@/lib/youtube";
import { formatDateLong } from "@/lib/format";

export function generateStaticParams() {
  return getDirectory().flatMap((entry) => {
    const groups = groupVideosByInferredEvent(
      getYoutubeVideosForChannel(entry.slug),
      entry.slug
    );
    return groups.map((g) => ({ org: entry.slug, group: g.slug }));
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string; group: string }>;
}): Promise<Metadata> {
  const { org, group: groupSlug } = await params;
  const group = getInferredEventGroup(org, groupSlug);
  if (!group) return {};
  return { title: `${group.label} — StreamETH Light` };
}

export default async function YoutubeEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; group: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { org: orgSlug, group: groupSlug } = await params;
  const { v } = await searchParams;

  const group = getInferredEventGroup(orgSlug, groupSlug);
  if (!group) notFound();

  const org = getOrganization(orgSlug);
  const directoryEntry = getDirectoryEntry(orgSlug);
  const orgName = org?.name ?? directoryEntry?.name ?? orgSlug;

  const selected = (v && group.videos.find((vid) => vid.videoId === v)) || group.videos[0];
  const others = group.videos.filter((vid) => vid.videoId !== selected.videoId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs uppercase tracking-wide text-ink-faint">
        <Link href={`/${orgSlug}`} className="transition-colors hover:text-ink-dim">
          {orgName}
        </Link>
        <span>/</span>
        <span>{group.label}</span>
      </div>

      <div className="aspect-video w-full overflow-hidden rounded-md border border-line bg-black">
        <iframe
          key={selected.videoId}
          src={`https://www.youtube-nocookie.com/embed/${selected.videoId}`}
          title={selected.title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      <div className="flex flex-col gap-3 border-b border-line pb-8">
        <h1 className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
          {selected.title}
        </h1>
        <p className="font-mono text-xs tabular text-ink-faint">
          {selected.publishedAt ? formatDateLong(selected.publishedAt) : ""}
          <span className="ml-2 rounded-sm bg-panel-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-dim">
            YouTube
          </span>
        </p>
        {selected.description && (
          <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-dim">
            {selected.description}
          </p>
        )}
      </div>

      {others.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">
            More from {group.label}
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {others.map((vid) => (
              <Link
                key={vid.videoId}
                href={`/${orgSlug}/y/${groupSlug}?v=${vid.videoId}`}
                className="group flex flex-col gap-2.5"
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-panel">
                  {vid.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={vid.thumbnail}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                      No preview
                    </div>
                  )}
                  <span className="absolute inset-0 ring-1 ring-inset ring-white/5 transition-colors group-hover:ring-accent/40" />
                </div>
                <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
                  {vid.title}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
