import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrgForEvent, listAllEvents } from "@/lib/data";
import { buildMetadata } from "@/lib/social";
import { breadcrumbJsonLd, eventJsonLd, truncate } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import EventCoverage, { parseEventTab, parseVideoLength } from "@/components/EventCoverage";
import {
  eventCover,
  eventFormatCounts,
  formatEventDates,
  getSeasonEventByPath,
  requestTime,
} from "@/lib/season";

export function generateStaticParams() {
  return listAllEvents()
    .map((event) => {
      const org = getOrgForEvent(event);
      return org ? { org: org.slug, event: event.slug } : null;
    })
    .filter((p): p is { org: string; event: string } => p !== null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string; event: string }>;
}): Promise<Metadata> {
  const { org: orgSlug, event: eventSlug } = await params;
  const event = getSeasonEventByPath(orgSlug, eventSlug);
  if (!event) return {};
  const path = event.href ?? `/${orgSlug}/${eventSlug}`;
  const where = `${formatEventDates(event)}${event.city ? ` in ${event.city}` : ""}`;
  let meta: Metadata;
  if (event.videoIds) {
    const counts = eventFormatCounts(event);
    const count = counts.talk + counts.clip + counts.short + counts.stream;
    meta = buildMetadata({
      title: `${event.name} — StreamETH`,
      description: truncate(
        event.description || `${count} ${count === 1 ? "recording" : "recordings"} from ${event.name}, ${where}.`,
        200
      ),
      image: eventCover(event) ?? undefined,
      path,
    });
  } else {
    meta = buildMetadata({
      title: `${event.name} — live coverage on StreamETH`,
      description: truncate(`${event.name}, ${where}: talks, streams, Shorts and reporting as it happens.`, 200),
      path,
    });
  }
  // Feed readers find the event's RSS feed from the page.
  return {
    ...meta,
    alternates: { canonical: path, types: { "application/rss+xml": `${path}/feed.xml` } },
  };
}

/** Every event's coverage page — calendar events and archive events alike.
 * Rendered per request, since what's live changes by the minute
 * (searchParams makes it dynamic; ?now= previews in development). */
export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; event: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { org: orgSlug, event: eventSlug } = await params;
  const event = getSeasonEventByPath(orgSlug, eventSlug);
  if (!event) notFound();
  const query = await searchParams;
  const path = event.href ?? `/${orgSlug}/${eventSlug}`;

  return (
    <>
      <JsonLd
        data={[
          eventJsonLd({
            name: event.name,
            path,
            description: event.description ?? undefined,
            start: event.start,
            end: event.end,
            location: event.city ?? undefined,
            image: eventCover(event) ?? undefined,
            organizer: event.channelName && event.channelHref ? { name: event.channelName, path: event.channelHref } : undefined,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            ...(event.channelName && event.channelHref ? [{ name: event.channelName, path: event.channelHref }] : []),
            { name: event.name, path },
          ]),
        ]}
      />
      <EventCoverage
        event={event}
        now={requestTime(query.now)}
        tab={parseEventTab(query.tab)}
        length={parseVideoLength(query.length)}
        day={typeof query.day === "string" ? query.day : undefined}
        playing={typeof query.v === "string" ? query.v : undefined}
      />
    </>
  );
}
