import type { MetadataRoute } from "next";
import { listVideosForSitemap } from "@/lib/videoDb";
import { VIDEOS_PER_SITEMAP, videoSitemapIds } from "@/lib/sitemaps";
import { absoluteUrl, videoLongDescription, videoThumbnail, xmlEscape } from "@/lib/seo";

// Google's video sitemap caps duration at 8 hours; longer livestream
// recordings are listed without one rather than rejected.
const MAX_DURATION_SECONDS = 28800;

export function generateSitemaps() {
  return videoSitemapIds().map((id) => ({ id }));
}

/** Video sitemaps for every watch page (StreamETH sessions and YouTube
 * videos), served at /watch/sitemap/<id>.xml and listed in robots.txt. */
export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const videos = listVideosForSitemap(id * VIDEOS_PER_SITEMAP, VIDEOS_PER_SITEMAP);

  return videos.map((video) => {
    const youtubeId = video.source === "youtube" ? video.id.replace(/^yt-/, "") : undefined;
    const duration =
      video.durationSeconds && video.durationSeconds >= 1 && video.durationSeconds <= MAX_DURATION_SECONDS
        ? Math.round(video.durationSeconds)
        : undefined;
    const published = video.publishedAt > 0 ? new Date(video.publishedAt) : undefined;
    return {
      url: absoluteUrl(`/watch/${video.id}`),
      lastModified: published,
      videos: [
        {
          title: xmlEscape(video.title.slice(0, 100)),
          thumbnail_loc: xmlEscape(videoThumbnail(video)),
          description: xmlEscape(videoLongDescription(video)),
          ...(video.contentUrl ? { content_loc: xmlEscape(video.contentUrl) } : {}),
          ...(youtubeId ? { player_loc: xmlEscape(`https://www.youtube.com/embed/${youtubeId}`) } : {}),
          ...(duration ? { duration } : {}),
          ...(published ? { publication_date: published.toISOString() } : {}),
          ...(video.topics[0] ? { tag: xmlEscape(video.topics[0]) } : {}),
          family_friendly: "yes",
          requires_subscription: "no",
          // Next.js prints a literal "undefined" attribute when uploader
          // has no `info`, so only emit it with the channel page URL.
          ...(video.orgName && video.orgSlug
            ? { uploader: { content: xmlEscape(video.orgName), info: xmlEscape(absoluteUrl(`/${video.orgSlug}`)) } }
            : {}),
        },
      ],
    };
  });
}
