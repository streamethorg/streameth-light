import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import {
  browseVideos,
  getVideoById,
  listChannelSummaries,
  topTopics,
  type UnifiedVideo,
} from "@/lib/videoDb";
import { getFullTranscript } from "@/lib/transcriptChunks";
import { EMPTY_FILTERS, type SortMode } from "@/lib/browseParams";
import { SITE_NAME, SITE_URL } from "@/lib/social";
import { verifySupabaseToken } from "@/lib/supabase/mcpAuth";
import {
  consumeStoryQuota,
  getStoryForWrite,
  insertStory,
  listReportersForUser,
  NOT_A_REPORTER,
  storiesConfigured,
  updateStory,
  userCanReport,
  verifyDraft,
  withdrawStory,
  STORY_KINDS,
  TRUST_AFTER_STORIES,
  storyLimits,
  type Reporter,
  type SaveStoryInput,
} from "@/lib/stories";
import { eventCoverage, formatEventDates, getSeasonEvent, listSeasonEvents, statusOf } from "@/lib/season";
import { coverageGaps, eventDayCount } from "@/lib/coverage";
import { addEmbed, listEmbedsForUser, removeEmbed } from "@/lib/embeds";

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
    hasTranscript: v.hasTranscript,
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
const WRITES = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

/** The signed-in user behind this MCP request (set by verifySupabaseToken). */
function userIdOf(ctx: { http?: { authInfo?: { extra?: Record<string, unknown> } } }): string | null {
  const id = ctx.http?.authInfo?.extra?.userId;
  return typeof id === "string" ? id : null;
}

/** The caller's reporter by slug, for filing: they must run it and still be
 * on the reporter list. */
async function filingReporter(
  ctx: Parameters<typeof userIdOf>[0],
  reporterSlug: string
): Promise<Reporter | { error: string }> {
  const userId = userIdOf(ctx);
  if (!userId) return { error: "Not signed in." };
  if (!(await userCanReport(userId))) return { error: NOT_A_REPORTER };
  return ownReporter(ctx, reporterSlug);
}

async function ownReporter(
  ctx: Parameters<typeof userIdOf>[0],
  reporterSlug: string
): Promise<Reporter | { error: string }> {
  const userId = userIdOf(ctx);
  if (!userId) return { error: "Not signed in." };
  const reporters = await listReportersForUser(userId);
  const reporter = reporters.find((r) => r.slug === reporterSlug);
  if (!reporter) {
    return {
      error: reporters.length
        ? `You don't run a reporter "${reporterSlug}". Yours: ${reporters.map((r) => r.slug).join(", ")}.`
        : `You don't run any reporters yet. Create one at ${absoluteUrl("/connect#reporters")}.`,
    };
  }
  if (reporter.trust === "suspended") return { error: `Reporter "${reporterSlug}" is suspended.` };
  return reporter;
}

/** Event keys are season event keys ("mira:<id>"), optionally a day of one
 * ("mira:<id>:day-2"). */
function invalidEventKeys(keys: string[]): string[] {
  return keys.filter((key) => {
    const m = key.match(/^(mira:[A-Za-z0-9]+)(?::day-(\d+))?$/);
    if (!m) return true;
    const event = getSeasonEvent(m[1]);
    if (!event) return true;
    return m[2] !== undefined && (Number(m[2]) < 1 || Number(m[2]) > eventDayCount(event));
  });
}

const STORY_FIELDS = {
  kind: z.enum(STORY_KINDS as [string, ...string[]]).describe(
    "day = one event day; recap = a whole event after it ends; preview = before it starts; thread = a topic across events; lead = a front-page story"
  ),
  headline: z.string().min(8).max(160),
  standfirst: z.string().min(20).max(400).describe("One-sentence summary under the headline"),
  body: z
    .string()
    .min(200)
    .max(12000)
    .describe(
      "Markdown: short paragraphs and \"- \" bullets, **bold**. Every paragraph cites archive talks as [n] (and outside links as [w1]). Text in double quotes must be word for word from a talk the same paragraph cites."
    ),
  sources: z
    .array(z.object({ n: z.number().int().min(1), videoId: z.string().min(1) }))
    .min(1)
    .max(60)
    .describe("Archive talks cited as [n]: video ids from search_videos / get_event_coverage"),
  quotes: z
    .array(
      z.object({
        text: z.string().min(1).max(600),
        n: z.number().int().min(1),
        speaker: z.string().max(80).optional(),
      })
    )
    .max(12)
    .optional()
    .describe("Pulled quotes shown beside the story; each must be in source n's transcript (get_transcript)"),
  externalSources: z
    .array(z.object({ n: z.number().int().min(1), url: z.string().url(), title: z.string().min(1).max(200) }))
    .max(12)
    .optional()
    .describe("Outside links (tweets, posts) cited as [wN]. Shown as unverified."),
  eventKeys: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe('Events this covers, from list_season_events (e.g. "mira:rec123"); day reports add "mira:rec123:day-2"'),
  topic: z.string().max(80).optional().describe("Threads only: the topic"),
};

function toSaveInput(args: {
  kind: string;
  headline: string;
  standfirst: string;
  body: string;
  sources: { n: number; videoId: string }[];
  quotes?: { text: string; n: number; speaker?: string }[];
  externalSources?: { n: number; url: string; title: string }[];
  eventKeys: string[];
  topic?: string;
}): SaveStoryInput {
  return {
    kind: args.kind as SaveStoryInput["kind"],
    headline: args.headline,
    standfirst: args.standfirst,
    body: args.body,
    sources: args.sources,
    quotes: args.quotes ?? [],
    externalSources: args.externalSources ?? [],
    eventKeys: [...new Set(args.eventKeys)],
    topic: args.topic ?? null,
    model: null,
  };
}

/** Runs quota, event-key and verify checks; the failures, or null if the
 * story can be saved. */
async function checkSubmission(reporter: Reporter, input: SaveStoryInput, action: "submit" | "update") {
  const quota = await consumeStoryQuota(reporter.id, action);
  if (quota === "limited") return ["Daily limit reached for this reporter. Try again tomorrow."];
  if (quota === "unavailable") return ["Story submissions are unavailable right now. Try again later."];
  const badKeys = invalidEventKeys(input.eventKeys);
  if (badKeys.length) return [`Unknown event keys: ${badKeys.join(", ")}. Use list_season_events.`];
  const failures = await verifyDraft(input, { allowExternal: reporter.trust !== "house" });
  return failures.length ? failures : null;
}

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
          "Full details for one video by id: description, speakers, topics, channel, event, watch and download links, and whether it has a transcript.",
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
        const transcript = await getFullTranscript(id);
        if (!transcript) return error(`"${video.title}" has no transcript.`);
        const total = transcript.length;
        if (offset >= total) return error(`offset ${offset} is past the end (transcript is ${total} chars).`);
        const end = Math.min(offset + maxChars, total);
        return json({
          id: video.id,
          title: video.title,
          totalChars: total,
          offset,
          nextOffset: end < total ? end : null,
          text: transcript.slice(offset, end),
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

    server.registerTool(
      "list_season_events",
      {
        title: "List season events",
        description:
          "Ethereum events this season (live, upcoming, recently ended), with the event key stories cite, dates, city, status and the channel that covers each.",
        inputSchema: z.object({}),
        annotations: READ_ONLY,
      },
      async () =>
        json(
          listSeasonEvents().map((e) => ({
            eventKey: e.key,
            name: e.name,
            dates: formatEventDates(e),
            start: e.start,
            end: e.end,
            city: e.city,
            status: statusOf(e),
            days: eventDayCount(e),
            channel: e.channelSlug,
            url: e.href ? absoluteUrl(e.href) : e.website,
          }))
        )
    );

    server.registerTool(
      "get_event_coverage",
      {
        title: "Get event coverage",
        description:
          "An event's recordings so far (talks, clips, shorts, streams), newest first, with which have transcripts. Use these video ids as story sources.",
        inputSchema: z.object({
          eventKey: z.string().describe('From list_season_events, e.g. "mira:rec123"'),
          limit: z.number().int().min(1).max(200).optional().describe("Max videos (default 100)"),
        }),
        annotations: READ_ONLY,
      },
      async ({ eventKey, limit }) => {
        const event = getSeasonEvent(eventKey);
        if (!event) return error(`No season event "${eventKey}". Use list_season_events.`);
        const videos = eventCoverage(event, limit ?? 100);
        return json({
          eventKey: event.key,
          name: event.name,
          status: statusOf(event),
          count: videos.length,
          videos: videos.map((v) => ({ ...summarize(v), format: v.format })),
        });
      }
    );

    server.registerTool(
      "get_coverage_gaps",
      {
        title: "Get coverage gaps",
        description:
          "The assignment desk: event days with enough transcribed talks but no day report, ended events with no recap, and events starting within a week with no preview. Each gap lists the event keys and video ids to write from.",
        inputSchema: z.object({}),
        annotations: READ_ONLY,
      },
      async () => {
        if (!storiesConfigured()) return error("Stories aren't set up on this server.");
        return json(await coverageGaps());
      }
    );

    server.registerTool(
      "list_my_reporters",
      {
        title: "List my reporters",
        description: `The reporter bylines you run. A new reporter's stories reach the homepage once it has ${TRUST_AFTER_STORIES} published stories with no open mistake reports.`,
        inputSchema: z.object({}),
        annotations: READ_ONLY,
      },
      async (_args, ctx) => {
        const userId = userIdOf(ctx);
        if (!userId) return error("Not signed in.");
        const [reporters, canReport] = await Promise.all([listReportersForUser(userId), userCanReport(userId)]);
        if (!canReport && reporters.length === 0) return error(NOT_A_REPORTER);
        return json({
          ...(canReport ? {} : { notice: NOT_A_REPORTER }),
          reporters: reporters.map((r) => ({
            slug: r.slug,
            name: r.name,
            trust: r.trust,
            url: absoluteUrl(`/reporters/${r.slug}`),
          })),
          create: reporters.length ? undefined : `Create one at ${absoluteUrl("/connect#reporters")}`,
        });
      }
    );

    server.registerTool(
      "submit_story",
      {
        title: "Submit story",
        description: `Publish a story under one of your reporter bylines. It goes live immediately if it passes verification: every paragraph cites archive talks [n], every citation resolves, every quote is word for word in the cited talk's transcript and attributed to one of its speakers. On failure you get the list of problems — fix them and resubmit. Limit: ${storyLimits().submitsPerDay} submissions per reporter per day, failures included. Full rules: ${absoluteUrl("/reporters.md")}`,
        inputSchema: z.object({ reporterSlug: z.string().describe("From list_my_reporters"), ...STORY_FIELDS }),
        annotations: WRITES,
      },
      async (args, ctx) => {
        if (!storiesConfigured()) return error("Stories aren't set up on this server.");
        const reporter = await filingReporter(ctx, args.reporterSlug);
        if ("error" in reporter) return error(reporter.error);
        const input = toSaveInput(args);
        const failures = await checkSubmission(reporter, input, "submit");
        if (failures) return error(`Not published:\n- ${failures.join("\n- ")}`);
        const saved = await insertStory(reporter, input);
        if (!saved.ok) return error(saved.error);
        return json({ status: "published", slug: saved.story.slug, url: absoluteUrl(`/stories/${saved.story.slug}`) });
      }
    );

    server.registerTool(
      "update_story",
      {
        title: "Update story",
        description:
          "Replace one of your stories' content. Verified the same way as submit_story; the slug stays and the old version is kept as a revision readers can see.",
        inputSchema: z.object({ slug: z.string(), ...STORY_FIELDS }),
        annotations: WRITES,
      },
      async (args, ctx) => {
        if (!storiesConfigured()) return error("Stories aren't set up on this server.");
        const story = await getStoryForWrite(args.slug);
        if (!story || !story.reporter) return error(`No story "${args.slug}".`);
        const owned = await ownReporter(ctx, story.reporter.slug);
        if ("error" in owned) return error(`That story isn't yours to edit.`);
        const reporter = await filingReporter(ctx, story.reporter.slug);
        if ("error" in reporter) return error(reporter.error);
        if (story.status === "withdrawn") return error("That story was withdrawn.");
        const input = toSaveInput(args);
        const failures = await checkSubmission(reporter, input, "update");
        if (failures) return error(`Not updated:\n- ${failures.join("\n- ")}`);
        const saved = await updateStory(story, input);
        if (!saved.ok) return error(saved.error);
        return json({ status: "updated", slug: saved.story.slug, url: absoluteUrl(`/stories/${saved.story.slug}`) });
      }
    );

    server.registerTool(
      "withdraw_story",
      {
        title: "Withdraw story",
        description: "Take one of your stories down. Its link stays and says it was withdrawn.",
        inputSchema: z.object({ slug: z.string() }),
        annotations: { ...WRITES, destructiveHint: true },
      },
      async ({ slug }, ctx) => {
        if (!storiesConfigured()) return error("Stories aren't set up on this server.");
        const story = await getStoryForWrite(slug);
        if (!story || !story.reporter) return error(`No story "${slug}".`);
        const reporter = await ownReporter(ctx, story.reporter.slug);
        if ("error" in reporter) return error(`That story isn't yours to withdraw.`);
        if (!(await withdrawStory(story.id))) return error("Couldn't withdraw the story. Try again.");
        return json({ status: "withdrawn", slug });
      }
    );

    server.registerTool(
      "embed_media",
      {
        title: "Add media to an event's feed",
        description:
          "Share a link in an event's feed under one of your reporter bylines: a YouTube video or Short, an X post, a Vimeo or TikTok video, a Spotify or SoundCloud item (these play in the feed), or any other https page (shown as a link card). Nothing is copied; the original is embedded and credited. Live immediately. Get event keys from list_season_events.",
        inputSchema: z.object({
          reporterSlug: z.string().describe("From list_my_reporters"),
          eventKey: z.string().describe("From list_season_events, e.g. mira:123"),
          url: z.string().describe("The link to share"),
          note: z.string().max(280).optional().describe("One line on why it matters, shown with it"),
        }),
        annotations: { ...WRITES, openWorldHint: true },
      },
      async (args, ctx) => {
        const userId = userIdOf(ctx);
        if (!userId) return error("Not signed in.");
        const result = await addEmbed({ userId }, args);
        if (!result.ok) return error(result.error);
        return json({
          status: "added",
          id: result.embed.id,
          provider: result.embed.provider,
          title: result.embed.title,
          url: absoluteUrl(result.embed.eventUrl),
        });
      }
    );

    server.registerTool(
      "list_my_embeds",
      {
        title: "List my media",
        description: "The links your reporters have added to event feeds, newest first, with their ids for remove_embed.",
        inputSchema: z.object({}),
        annotations: READ_ONLY,
      },
      async (_args, ctx) => {
        const userId = userIdOf(ctx);
        if (!userId) return error("Not signed in.");
        const embeds = await listEmbedsForUser(userId);
        return json({
          embeds: embeds.map((e) => {
            const event = getSeasonEvent(e.eventKey);
            return {
              id: e.id,
              reporterSlug: e.reporter.slug,
              eventKey: e.eventKey,
              event: event?.name ?? null,
              provider: e.provider,
              title: e.title,
              url: e.url,
              note: e.note,
              addedAt: e.createdAt,
            };
          }),
        });
      }
    );

    server.registerTool(
      "remove_embed",
      {
        title: "Remove media from a feed",
        description: "Take a link one of your reporters added out of its event's feed.",
        inputSchema: z.object({ id: z.string().describe("From list_my_embeds") }),
        annotations: { ...WRITES, destructiveHint: true },
      },
      async ({ id }, ctx) => {
        const userId = userIdOf(ctx);
        if (!userId) return error("Not signed in.");
        const result = await removeEmbed(userId, id);
        if (!result.ok) return error(result.error);
        return json({ status: "removed", id });
      }
    );
  },
  {
    serverInfo: { name: "streameth-archive", version: "1.0.0" },
    instructions: `${SITE_NAME}: live coverage of Ethereum events — talks, panels and livestreams, and reporting on them. Use search_videos to find videos, get_video for details, and get_transcript to read what was said. To report: list_season_events and get_coverage_gaps show what needs covering, get_event_coverage lists an event's recordings, and submit_story publishes under a reporter byline you run (list_my_reporters); embed_media shares a video, post or page in an event's feed. Before reporting, read the guide at ${absoluteUrl("/reporters.md")}: stories are fact-checked automatically and rejected unless every paragraph cites a talk and every quote matches its transcript.`,
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
