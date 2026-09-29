import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VideoCard from "@/components/VideoCard";
import { getOrganization, listOrganizations } from "@/lib/data";
import {
  getInferredSessionGroup,
  getOrphanSessionsForOrg,
  groupSessionsByInferredEvent,
} from "@/lib/orphanSessions";
import { buildMetadata } from "@/lib/social";

export function generateStaticParams() {
  return listOrganizations().flatMap((org) => {
    const groups = groupSessionsByInferredEvent(
      getOrphanSessionsForOrg(org._id),
      org.slug,
      org.name
    );
    return groups.map((g) => ({ org: org.slug, group: g.slug }));
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string; group: string }>;
}): Promise<Metadata> {
  const { org: orgSlug, group: groupSlug } = await params;
  const org = getOrganization(orgSlug);
  if (!org) return {};
  const group = getInferredSessionGroup(org._id, org.slug, org.name, groupSlug);
  if (!group) return {};
  return buildMetadata({
    title: `${group.label} — StreamETH`,
    image: group.sessions[0]?.coverImage,
  });
}

export default async function OrphanSessionGroupPage({
  params,
}: {
  params: Promise<{ org: string; group: string }>;
}) {
  const { org: orgSlug, group: groupSlug } = await params;
  const org = getOrganization(orgSlug);
  if (!org) notFound();

  const group = getInferredSessionGroup(org._id, org.slug, org.name, groupSlug);
  if (!group) notFound();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-4">
        <Link
          href={`/${org.slug}`}
          className="w-fit font-mono text-xs uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-dim"
        >
          ← {org.name}
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          {group.label}
        </h1>
        <p className="font-mono text-xs tabular text-ink-faint">
          {String(group.sessions.length).padStart(2, "0")} video
          {group.sessions.length === 1 ? "" : "s"}
        </p>
        <p className="max-w-2xl font-mono text-xs text-ink-faint">
          These sessions exist in StreamETH&apos;s database but have no
          linked event record, so they&apos;re grouped here by inferred
          event instead of official event metadata.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {group.sessions.map((s) => (
          <VideoCard key={s._id} session={s} />
        ))}
      </div>
    </div>
  );
}
