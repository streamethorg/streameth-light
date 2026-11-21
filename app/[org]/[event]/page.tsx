import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrgForEvent, listAllEvents } from "@/lib/data";
import { buildMetadata } from "@/lib/social";
import { breadcrumbJsonLd, eventJsonLd, truncate } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import type { VideoFormat } from "@/lib/videoDb";
import EventCoverage, { parseEventTab, parseVideoLength } from "@/components/EventCoverage";
import {
  eventCover,
  eventFormatCounts,
  formatEventDates,
  getSeasonEventByPath,
  requestTime,
  statusOf,
} from "@/lib/season";

/** "12 talks and 3 livestreams" — what's there to watch, for titles and
 * descriptions. */
function watchSummary(counts: Record<VideoFormat, number>): string | undefined {
  const parts: string[] = [];
  const talks = counts.talk + counts.clip;
  if (talks > 0) parts.push(`${talks} ${talks === 1 ? "talk" : "talks"}`);
  if (counts.stream > 0) parts.push(`${counts.stream} ${counts.stream === 1 ? "livestream" : "livestreams"}`);
  if (parts.length === 0 && counts.short > 0) parts.push(`${counts.short} ${counts.short === 1 ? "Short" : "Shorts"}`);
  return parts.length > 0 ? parts.join(" and ") : undefined;
}

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
    // "Pragma (ETHGlobal) — 2026 — StreamETH" (13 impressions at position
    // 6.7, 0 clicks) doesn't say there's anything to watch; lead with it.
    const counts = eventFormatCounts(event);
    const count = counts.talk + counts.clip + counts.short + counts.stream;
    const summary = watchSummary(counts);
    meta = buildMetadata({
      title: summary ? `${event.name}: ${summary} — StreamETH` : `${event.name} — StreamETH`,
      description: truncate(
        event.description ||
          `Watch ${summary ?? `${count} ${count === 1 ? "recording" : "recordings"}`} from ${event.name}, ${where}, with speakers and topics.`,
        200
      ),
      image: eventCover(event) ?? undefined,
      path,
    });
  } else if (statusOf(event) === "past") {
    // Two weeks after it ends, nobody is looking for live coverage any more
    // (TOKEN2049 Singapore 2026: 14 impressions at position 4.5, 0 clicks);
    // say what the archive holds instead.
    const summary = watchSummary(eventFormatCounts(event));
    meta = buildMetadata({
      title: summary ? `${event.name}: ${summary} — StreamETH` : `${event.name} talks & recordings — StreamETH`,
      description: truncate(
        `Watch ${summary ?? "the talks"} from ${event.name}, ${where}, with speakers and topics.`,
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
