import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import {
  browseVideos,
  getVideoById,
  listChannelSummaries,
  topTopics,
  type UnifiedVideo,
} from "@/lib/videoDb";
import { EMPTY_FILTERS, type SortMode } from "@/lib/browseParams";
import { SITE_NAME, SITE_URL } from "@/lib/social";
import { verifySupabaseToken } from "@/lib/supabase/mcpAuth";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_TRANSCRIPT_CHARS = 20_000;
const MAX_TRANSCRIPT_CHARS = 100_000;

const SORT_MODES = ["relevance", "newest", "oldest", "duration_desc", "duration_asc"] as const;
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

function isoDate(ms: number): string | null {
  return ms > 0 ? new Date(ms).toISOString().slice(0, 10) : null;
}

/** The compact shape returned in search results — no transcript, which can
 * be hundreds of KB; agents fetch it separately with `get_transcript`. */
function summarize(v: UnifiedVideo) {
  return {
    id: v.id,
    title: v.title,
    channel: v.orgName,
    channelSlug: v.orgSlug,
    event: v.eventName || null,
    speakers: v.speakers,
    publishedAt: isoDate(v.publishedAt),
    durationSeconds: v.durationSeconds === null ? null : Math.round(v.durationSeconds),
    hasTranscript: Boolean(v.transcript),
    url: absoluteUrl(v.watchUrl),
  };
}

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function error(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_videos",
      {
        title: "Search videos",
        description:
          "Search the archive of Ethereum ecosystem talks, panels and livestreams. Full-text search covers titles, descriptions, speakers, topics, channels, events and transcripts. All filters are optional; with no query, results are newest first.",
        inputSchema: z.object({
          query: z.string().optional().describe("Full-text search terms, e.g. \"account abstraction\""),
          channel: z
            .string()
            .optional()
            .describe("Channel slug to restrict to (see list_channels), e.g. \"devcon\""),
          speaker: z.string().optional().describe("Speaker name, partial match"),
          topic: z.string().optional().describe("Topic tag, partial match (see list_topics)"),
          from: DATE.optional().describe("Earliest publish date, YYYY-MM-DD"),
          to: DATE.optional().describe("Latest publish date (inclusive), YYYY-MM-DD"),
          sort: z
            .enum(SORT_MODES)
            .optional()
            .describe("Defaults to relevance when a query is given, otherwise newest"),
          limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Max results (default ${DEFAULT_LIMIT})`),
        }),
        annotations: READ_ONLY,
      },
      async ({ query, channel, speaker, topic, from, to, sort, limit }) => {
        const q = query?.trim() ?? "";
        const sortMode: SortMode = sort ?? (q ? "relevance" : "newest");
        const videos = browseVideos(
          {
            ...EMPTY_FILTERS,
            q,
            orgIds: channel ? [channel] : [],
            speaker: speaker?.trim() ?? "",
            topic: topic?.trim() ?? "",
            dateFrom: from ?? "",
            dateTo: to ?? "",
            sort: sortMode,
          },
          limit ?? DEFAULT_LIMIT
        );
        return json({ count: videos.length, results: videos.map(summarize) });
      }
    );

    server.registerTool(
      "get_video",
      {
        title: "Get video",
        description:
          "Full details for one video by id: description, speakers, topics, channel, event, watch and download links, and transcript length.",
        inputSchema: z.object({
          id: z.string().min(1).describe("Video id from search_videos"),
        }),
        annotations: READ_ONLY,
      },
      async ({ id }) => {
        const video = getVideoById(id);
        if (!video) return error(`No video with id "${id}".`);
        return json({
          ...summarize(video),
          description: video.description,
          topics: video.topics,
          source: video.source,
          coverImage: video.coverImage,
          downloadUrl: video.downloadUrl,
          transcriptChars: video.transcript?.length ?? 0,
        });
      }
    );

    server.registerTool(
      "get_transcript",
      {
        title: "Get transcript",
        description:
          "A video's transcript text. Long transcripts are paged: pass the returned nextOffset as offset to read the next chunk.",
        inputSchema: z.object({
          id: z.string().min(1).describe("Video id from search_videos"),
          offset: z.number().int().min(0).optional().describe("Character offset to start at (default 0)"),
          maxChars: z
            .number()
            .int()
            .min(1000)
            .max(MAX_TRANSCRIPT_CHARS)
            .optional()
            .describe(`Max characters to return (default ${DEFAULT_TRANSCRIPT_CHARS})`),
        }),
        annotations: READ_ONLY,
      },
      async ({ id, offset = 0, maxChars = DEFAULT_TRANSCRIPT_CHARS }) => {
        const video = getVideoById(id);
        if (!video) return error(`No video with id "${id}".`);
        if (!video.transcript) return error(`"${video.title}" has no transcript.`);
        const total = video.transcript.length;
        if (offset >= total) return error(`offset ${offset} is past the end (transcript is ${total} chars).`);
        const end = Math.min(offset + maxChars, total);
        return json({
          id: video.id,
          title: video.title,
          totalChars: total,
          offset,
          nextOffset: end < total ? end : null,
          text: video.transcript.slice(offset, end),
        });
      }
    );

    server.registerTool(
      "list_channels",
      {
        title: "List channels",
        description:
          "Every channel (conference, org or YouTube channel) in the archive with its slug, video count and latest upload date, biggest first.",
        inputSchema: z.object({}),
        annotations: READ_ONLY,
      },
      async () =>
        json(
          listChannelSummaries().map((c) => ({
            slug: c.slug,
            name: c.name,
            videos: c.videos,
            latest: isoDate(c.latest),
            url: absoluteUrl(`/${c.slug}`),
          }))
        )
    );

    server.registerTool(
      "list_topics",
      {
        title: "List topics",
        description: "The most common topic tags across the archive, most frequent first.",
        inputSchema: z.object({
          limit: z.number().int().min(1).max(200).optional().describe("Max topics (default 50)"),
        }),
        annotations: READ_ONLY,
      },
      async ({ limit }) => json(topTopics(limit ?? 50))
    );
  },
  {
    serverInfo: { name: "streameth-archive", version: "1.0.0" },
    instructions: `${SITE_NAME} video archive: talks, panels and livestreams from Ethereum ecosystem events. Use search_videos to find videos, get_video for details, and get_transcript to read what was said.`,
  }
);

// Signed-in users only: MCP clients discover Supabase Auth as the OAuth
// server via the protected-resource metadata, send the user through
// /oauth/consent, and call back here with the resulting access token.
const authHandler = withMcpAuth(handler, verifySupabaseToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
