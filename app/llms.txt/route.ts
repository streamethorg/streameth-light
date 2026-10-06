import { archiveStats, listChannelSummaries } from "@/lib/videoDb";
import { listRecentEvents } from "@/lib/events";
import { listSpeakers } from "@/lib/people";
import { listTopics } from "@/lib/topics";
import { SITE_NAME } from "@/lib/social";
import { absoluteUrl } from "@/lib/seo";

// Built once at build time from the same static data as the site; the data
// only changes with a deploy.
export const dynamic = "force-static";

const MAX_SPEAKERS = 300;
const MAX_TOPICS = 150;

function mdLink(label: string, path: string): string {
  return `[${label.replace(/[[\]]/g, "")}](${absoluteUrl(path)})`;
}

/** /llms.txt (https://llmstxt.org): a plain-markdown map of the archive for
 * AI assistants and answer engines — what's here, how it's organized, and
 * where to get clean text (per-talk markdown with transcripts, or the MCP
 * server) instead of scraping HTML. */
export function GET() {
  const stats = archiveStats();
  const events = listRecentEvents();
  const channels = listChannelSummaries();
  const speakers = listSpeakers().slice(0, MAX_SPEAKERS);
  const topics = listTopics().slice(0, MAX_TOPICS);

  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> An archive of ${stats.videos.toLocaleString("en-US")} talks, panels and livestreams from ${stats.channels.toLocaleString("en-US")} Ethereum ecosystem conferences, meetups and channels — with speakers, topics and full transcripts where available.`,
    "",
    "Every talk has a page at `/watch/<id>`. Append `.md` to any watch URL (for example `/watch/<id>.md`) for a plain-markdown version with the title, speakers, event, date, description and full transcript. Please link to the watch page when citing a talk.",
    "",
    `For programmatic access, a read-only MCP server at ${absoluteUrl("/api/mcp")} offers full-text search across titles, descriptions, speakers and transcripts (setup: ${absoluteUrl("/connect")}).`,
    "",
    "## Browse",
    "",
    `- ${mdLink("Latest talks", "/")}: newest videos across every channel`,
    `- ${mdLink("Events", "/events")}: conferences and meetups, newest first`,
    `- ${mdLink("Channels", "/channels")}: every organization and channel in the archive`,
    `- ${mdLink("Speakers", "/speakers")}: everyone with a recorded talk`,
    `- ${mdLink("Topics", "/topics")}: talks grouped by subject`,
    "",
    "## Events",
    "",
    ...events.map(
      (e) =>
        `- ${mdLink(e.name, e.href)}: ${e.talkCount} ${e.talkCount === 1 ? "talk" : "talks"}, ${e.channelName}${e.location ? `, ${e.location}` : ""}`
    ),
    "",
    "## Channels",
    "",
    ...channels.map((c) => `- ${mdLink(c.name, `/${c.slug}`)}: ${c.videos} ${c.videos === 1 ? "video" : "videos"}`),
    "",
    "## Speakers",
    "",
    ...speakers.map(
      (s) =>
        `- ${mdLink(s.name, `/speakers/${s.slug}`)}: ${s.sessionIds.length} ${s.sessionIds.length === 1 ? "talk" : "talks"}${s.company ? `, ${s.company}` : ""}`
    ),
    "",
    "## Optional",
    "",
    ...topics.map(
      (t) => `- ${mdLink(t.name, `/topics/${t.slug}`)}: ${t.sessionIds.length} ${t.sessionIds.length === 1 ? "talk" : "talks"}`
    ),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
