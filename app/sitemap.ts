import type { MetadataRoute } from "next";
import { getOrgForEvent, listAllEvents, listOrganizations, listSessionsForEvent } from "@/lib/data";
import { getDirectory } from "@/lib/directory";
import { getOrphanSessionsForOrg, groupSessionsByInferredEvent } from "@/lib/orphanSessions";
import { getYoutubeVideosForChannel, groupVideosByInferredEvent } from "@/lib/youtube";
import { listSpeakers } from "@/lib/people";
import { listTopics } from "@/lib/topics";
import { absoluteUrl, xmlEscape } from "@/lib/seo";

/** Every browsable non-video page: channels, events, speakers and topics.
 * Watch pages are in the video sitemaps (app/watch/sitemap.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const add = (path: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}) =>
    entries.push({ url: xmlEscape(absoluteUrl(path)), ...extra });

  add("/", { changeFrequency: "daily", priority: 1 });
  for (const path of ["/events", "/channels", "/speakers", "/topics"]) {
    add(path, { changeFrequency: "daily", priority: 0.8 });
  }

  for (const entry of getDirectory()) {
    add(`/${entry.slug}`, { changeFrequency: "weekly", priority: 0.7 });
    for (const group of groupVideosByInferredEvent(getYoutubeVideosForChannel(entry.slug), entry.slug)) {
      add(`/${entry.slug}/y/${group.slug}`, { changeFrequency: "monthly", priority: 0.5 });
    }
  }

  // Events with no playable session are empty shells — not worth a crawl.
  for (const event of listAllEvents()) {
    const org = getOrgForEvent(event);
    if (!org || listSessionsForEvent(event._id).length === 0) continue;
    const ended = Date.parse(event.end || event.start);
    add(`/${org.slug}/${event.slug}`, {
      changeFrequency: "monthly",
      priority: 0.7,
      ...(Number.isFinite(ended) ? { lastModified: new Date(ended) } : {}),
    });
  }

  for (const org of listOrganizations()) {
    for (const group of groupSessionsByInferredEvent(getOrphanSessionsForOrg(org._id), org.slug, org.name)) {
      add(`/${org.slug}/s/${group.slug}`, { changeFrequency: "monthly", priority: 0.5 });
    }
  }

  for (const speaker of listSpeakers()) {
    add(`/speakers/${speaker.slug}`, { changeFrequency: "monthly", priority: 0.6 });
  }
  for (const topic of listTopics()) {
    add(`/topics/${topic.slug}`, { changeFrequency: "weekly", priority: 0.5 });
  }

  return entries;
}
