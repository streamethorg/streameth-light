import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOrganization,
  listEventsForOrg,
  listSessionsForEvent,
} from "@/lib/data";
import { formatDateShort } from "@/lib/format";

export default async function OrgPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const org = getOrganization(orgSlug);
  if (!org) notFound();

  const events = listEventsForOrg(org._id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-3">
        <Link href="/" className="w-fit text-xs text-neutral-500 hover:text-neutral-300">
          ← Home
        </Link>
        <div className="flex items-center gap-4">
          {org.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo} alt={org.name} className="h-12 w-auto object-contain" />
          )}
          <h1 className="text-2xl font-semibold">{org.name}</h1>
        </div>
        {org.description && (
          <p className="max-w-2xl text-sm text-neutral-400">{org.description}</p>
        )}
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-neutral-500">No public events found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const count = listSessionsForEvent(event._id).length;
            return (
              <Link
                key={event._id}
                href={`/${org.slug}/${event.slug}`}
                className="group flex flex-col overflow-hidden rounded-lg border border-neutral-800 hover:border-neutral-600"
              >
                <div className="relative aspect-[2/1] w-full bg-neutral-800">
                  {(event.eventCover || event.banner) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.eventCover || event.banner}
                      alt={event.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1 p-4">
                  <h2 className="text-sm font-medium text-neutral-100 group-hover:text-white">
                    {event.name}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {event.start ? formatDateShort(event.start) : ""}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {count} video{count === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
