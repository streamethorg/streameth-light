/** Where a click on a video goes: its event's feed when it has one (the
 * video opens at the top, with the feed below), else its watch page. Watch
 * pages stay the canonical URL for search engines, sitemaps and the MCP
 * server. Plain module, so client components can use it too. */
export function videoLink(video: { feedUrl: string | null; watchUrl: string }): string {
  return video.feedUrl ?? video.watchUrl;
}

/** The same link with a find-in-transcript query, which the transcript
 * panel picks up from `?q=`. */
export function videoLinkWithQuery(href: string, q: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}`;
}
