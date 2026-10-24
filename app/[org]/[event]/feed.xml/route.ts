import { getSeasonEventByPath, formatEventDates } from "@/lib/season";
import { eventFeed, type FeedItem } from "@/lib/eventFeed";
import { absoluteUrl } from "@/lib/seo";
import { videoLink } from "@/lib/videoLink";
import { SITE_NAME } from "@/lib/social";

/** An event's live feed as RSS 2.0, at /<channel>/<event>/feed.xml: the
 * same items as the page's Live tab — stories, talks as they start on
 * stage, and new recordings — so people can follow an event in any feed
 * reader. Linked from the page as <link rel="alternate"
 * type="application/rss+xml">. */
export async function GET(_request: Request, ctx: RouteContext<"/[org]/[event]/feed.xml">) {
  const { org, event: eventSlug } = await ctx.params;
  const event = getSeasonEventByPath(org, eventSlug);
  if (!event || !event.href) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const now = Date.now();
  const items = await eventFeed(event, now, 100);
  const pageUrl = absoluteUrl(event.href);
  const lastBuild = items[0]?.at ?? now;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${event.name} — live coverage on ${SITE_NAME}`)}</title>
    <link>${escapeXml(pageUrl)}</link>
    <atom:link href="${escapeXml(absoluteUrl(`${event.href}/feed.xml`))}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(
      `Talks as they go on stage, new recordings and reporting from ${event.name}, ${formatEventDates(event)}${event.city ? `, ${event.city}` : ""}.`
    )}</description>
    <language>en</language>
    <lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
    <ttl>15</ttl>
${items.map((item) => renderItem(item, pageUrl)).join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Readers poll; five minutes keeps a live event fresh without
      // rebuilding the feed for every poll.
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

function renderItem(item: FeedItem, pageUrl: string): string {
  const { title, link, guid, description } = itemFields(item, pageUrl);
  return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${new Date(item.at).toUTCString()}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`;
}

function itemFields(item: FeedItem, pageUrl: string): { title: string; link: string; guid: string; description: string } {
  if (item.kind === "story") {
    const by = item.story.reporter?.name;
    return {
      title: item.story.headline,
      link: absoluteUrl(`/stories/${item.story.slug}`),
      guid: `story:${item.story.id}`,
      description: `${item.story.standfirst}${by ? ` — ${by}` : ""}`,
    };
  }
  if (item.kind === "session") {
    const s = item.session;
    return {
      title: `On stage now (${s.room}): ${s.title}`,
      link: pageUrl,
      guid: `session:${s.id}`,
      description: s.speakers.length > 0 ? `With ${s.speakers.join(", ")}.` : s.title,
    };
  }
  const v = item.video;
  const label = { talk: "New talk", clip: "New clip", short: "New Short", stream: "Stream recording" }[v.format];
  return {
    title: `${label}: ${v.title}`,
    link: absoluteUrl(videoLink(v)),
    guid: `video:${v.id}`,
    description: [v.speakers.length > 0 ? `With ${v.speakers.join(", ")}.` : "", v.description.slice(0, 400)]
      .filter(Boolean)
      .join(" "),
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Characters XML 1.0 doesn't allow at all (stray control codes in titles).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}
