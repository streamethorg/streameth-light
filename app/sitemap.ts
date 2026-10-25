import type { MetadataRoute } from "next";
import { listOrganizations } from "@/lib/data";
import { getDirectory } from "@/lib/directory";
import { getOrphanSessionsForOrg, groupSessionsByInferredEvent } from "@/lib/orphanSessions";
import { getYoutubeVideosForChannel, groupVideosByInferredEvent } from "@/lib/youtube";
import { listSpeakers } from "@/lib/people";
import { listCoverageEvents, statusOf, youtubeGroupHref } from "@/lib/season";
import { listPublishedForSitemap } from "@/lib/stories";
import { listTopics } from "@/lib/topics";
import { absoluteUrl, xmlEscape } from "@/lib/seo";

// Stories are published while the site runs (and events go live), so the
// sitemap is rebuilt hourly rather than frozen at deploy.
export const revalidate = 3600;

/** Every browsable non-video page: channels, event coverage pages, stories
 * and reporters, speakers and topics. Watch pages are in the video sitemaps
 * (app/watch/sitemap.ts). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const add = (path: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}) =>
    entries.push({ url: xmlEscape(absoluteUrl(path)), ...extra });

  add("/", { changeFrequency: "daily", priority: 1 });
  for (const path of ["/events", "/stories", "/speakers", "/topics"]) {
    add(path, { changeFrequency: "daily", priority: 0.8 });
  }

  for (const entry of getDirectory()) {
    add(`/${entry.slug}`, { changeFrequency: "weekly", priority: 0.7 });
    // Upload groups without a coverage page keep their old page; the rest
    // redirect to the coverage page listed below.
    for (const group of groupVideosByInferredEvent(getYoutubeVideosForChannel(entry.slug), entry.slug)) {
      if (!youtubeGroupHref(entry.slug, group.slug)) {
        add(`/${entry.slug}/y/${group.slug}`, { changeFrequency: "monthly", priority: 0.5 });
      }
    }
  }

  // Every event's coverage page: calendar events (live and coming up too —
  // that's when people search for them) and archive events with recordings.
  const now = Date.now();
  for (const event of listCoverageEvents()) {
    if (!event.href || (event.videoIds && event.videoIds.length === 0)) continue;
    const status = statusOf(event, now);
    add(event.href, {
      changeFrequency: status === "live" ? "hourly" : status === "past" ? "monthly" : "daily",
      priority: status === "live" || status === "upcoming" ? 0.9 : 0.7,
      ...(status === "past" ? { lastModified: new Date(event.to) } : {}),
    });
  }

  for (const org of listOrganizations()) {
    for (const group of groupSessionsByInferredEvent(getOrphanSessionsForOrg(org._id), org.slug, org.name)) {
      add(`/${org.slug}/s/${group.slug}`, { changeFrequency: "monthly", priority: 0.5 });
    }
  }

  const { stories, reporters } = await listPublishedForSitemap();
  for (const story of stories) {
    add(`/stories/${story.slug}`, { changeFrequency: "weekly", priority: 0.8, lastModified: new Date(story.updatedAt) });
  }
  for (const reporter of reporters) {
    add(`/reporters/${reporter.slug}`, { changeFrequency: "weekly", priority: 0.5, lastModified: new Date(reporter.updatedAt) });
  }

  for (const speaker of listSpeakers()) {
    add(`/speakers/${speaker.slug}`, { changeFrequency: "monthly", priority: 0.6 });
  }
  for (const topic of listTopics()) {
    add(`/topics/${topic.slug}`, { changeFrequency: "weekly", priority: 0.5 });
  }

  return entries;
}
