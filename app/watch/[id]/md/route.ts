import { getVideoById } from "@/lib/videoDb";
import { getEventById, getOrgForSession, getSession } from "@/lib/data";
import { findSpeakerSlugForName } from "@/lib/people";
import { formatTimecode } from "@/lib/format";
import { absoluteUrl, usableDescription } from "@/lib/seo";

/** Plain-markdown copy of a watch page, served at /watch/<id>.md (rewritten
 * here by next.config.ts) — what AI assistants and answer engines read
 * instead of the player UI. Listed in /llms.txt and linked from each watch
 * page as <link rel="alternate" type="text/markdown">. */
export async function GET(_request: Request, ctx: RouteContext<"/watch/[id]/md">) {
  const { id } = await ctx.params;
  const video = getVideoById(id);
  if (!video) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const pageUrl = absoluteUrl(`/watch/${video.id}`);
  // StreamETH sessions carry richer speaker and event records than the
  // unified table (bios, companies, event location).
  const session = video.source === "streameth" ? getSession(video.id) : undefined;
  const event = session ? getEventById(session.eventId) : undefined;
  const org = session ? getOrgForSession(session, event) : undefined;

  const facts: string[] = [];
  if (video.speakers.length > 0) {
    const names = video.speakers.map((name) => {
      const slug = findSpeakerSlugForName(name);
      return slug ? `[${name}](${absoluteUrl(`/speakers/${slug}`)})` : name;
    });
    facts.push(`- Speakers: ${names.join(", ")}`);
  }
  if (event && org) {
    facts.push(`- Event: [${event.name}](${absoluteUrl(`/${org.slug}/${event.slug}`)})${event.location ? `, ${event.location}` : ""}`);
  } else if (video.eventName) {
    facts.push(`- Event: ${video.eventName}`);
  }
  if (video.orgName) {
    facts.push(`- Channel: ${video.orgSlug ? `[${video.orgName}](${absoluteUrl(`/${video.orgSlug}`)})` : video.orgName}`);
  }
  if (video.publishedAt > 0) facts.push(`- Date: ${new Date(video.publishedAt).toISOString().slice(0, 10)}`);
  if (video.durationSeconds) facts.push(`- Duration: ${formatTimecode(video.durationSeconds)}`);
  if (video.topics.length > 0) facts.push(`- Topics: ${video.topics.join(", ")}`);
  facts.push(`- Watch: ${pageUrl}`);
  if (video.source === "youtube") facts.push(`- YouTube: https://www.youtube.com/watch?v=${video.id.replace(/^yt-/, "")}`);
  if (video.downloadUrl) facts.push(`- Download: ${video.downloadUrl}`);

  const sections = [`# ${video.title}`, "", ...facts];

  const description = usableDescription(video.description) && video.description.trim();
  if (description) {
    sections.push("", "## Description", "", description);
  }

  const bios = (session?.speakers ?? []).filter((sp) => usableDescription(sp.bio));
  if (bios.length > 0) {
    sections.push("", "## About the speakers", "");
    for (const sp of bios) {
      sections.push(`### ${sp.name}${sp.company ? ` (${sp.company})` : ""}`, "", sp.bio!.trim(), "");
    }
  }

  if (video.transcript?.trim()) {
    sections.push("", "## Transcript", "", video.transcript.trim());
  }

  return new Response(`${sections.join("\n").trimEnd()}\n`, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      // The HTML watch page is the one to rank; this copy is for AI readers.
      Link: `<${pageUrl}>; rel="canonical"`,
      "X-Robots-Tag": "noindex, follow",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
