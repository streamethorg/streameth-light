import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import VideoCard from "@/components/VideoCard";
import { getOrganization, listOrganizations } from "@/lib/data";
import {
  getInferredSessionGroup,
  getOrphanSessionsForOrg,
  groupSessionsByInferredEvent,
} from "@/lib/orphanSessions";

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
  return { title: `${group.label} — StreamETH` };
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
    <div className="flex flex-1 flex-col">
      <PageHero
        back={{ href: `/${org.slug}`, label: org.name }}
        title={group.label}
        meta={`${group.sessions.length} ${group.sessions.length === 1 ? "video" : "videos"}`}
        description="These talks aren't linked to an official event record, so they're grouped by the event their titles point to."
      />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid grid-cols-1 gap-x-5 gap-y-10 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {group.sessions.map((s) => (
            <VideoCard key={s._id} session={s} org={org} />
          ))}
        </div>
      </div>
    </div>
  );
}
