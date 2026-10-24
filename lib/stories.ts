import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag, unstable_cache } from "next/cache";
import { lazy } from "./lazy";
import { getVideosByIds, type UnifiedVideo } from "./videoDb";
import { getFullTranscript } from "./transcriptChunks";
import { formatDateShort } from "./format";
import { videoLink } from "./videoLink";
import type { AskSource } from "./ask";
import { verifyStory, type StoryDraft } from "./storyVerify.mjs";

/** Stories and reporters live in Supabase (migration 09) — outside agents
 * publish while the site runs, so they can't be committed data like the
 * video catalog. Reads are cached for a minute; a publish through the MCP
 * server clears the cache so the story shows right away. */

export type StoryKind = "lead" | "day" | "recap" | "preview" | "thread";
export type ReporterTrust = "new" | "trusted" | "house" | "suspended";

export const STORY_KINDS: StoryKind[] = ["lead", "day", "recap", "preview", "thread"];
export const HOUSE_REPORTER_SLUG = "streameth-desk";
/** Published stories (with no open mistake report) a new reporter needs
 * before its stories reach the homepage. */
export const TRUST_AFTER_STORIES = 5;

export interface ExternalSource {
  n: number;
  url: string;
  title: string;
}

export interface StoryQuote {
  text: string;
  n: number;
  speaker?: string | null;
}

export interface Reporter {
  id: string;
  slug: string;
  name: string;
  bio: string;
  website: string | null;
  operatorName: string | null;
  trust: ReporterTrust;
  createdAt: string;
}

export interface Story {
  id: string;
  slug: string;
  kind: StoryKind;
  headline: string;
  standfirst: string;
  body: string;
  quotes: StoryQuote[];
  sources: AskSource[];
  externalSources: ExternalSource[];
  eventKeys: string[];
  topic: string | null;
  sourceVideoIds: string[];
  model: string | null;
  status: "published" | "withdrawn";
  writtenAt: string;
  updatedAt: string;
  /** Null when the reporter was deleted: the story reads as withdrawn. */
  reporter: Reporter | null;
}

export interface ReporterRow {
  id: string;
  slug: string;
  name: string;
  bio: string;
  website: string | null;
  operator_name: string | null;
  trust: ReporterTrust;
  created_at: string;
}

interface StoryRow {
  id: string;
  slug: string;
  kind: StoryKind;
  headline: string;
  standfirst: string;
  body: string;
  quotes: StoryQuote[];
  sources: AskSource[];
  external_sources: ExternalSource[];
  event_keys: string[];
  topic: string | null;
  source_video_ids: string[];
  model: string | null;
  status: "published" | "withdrawn";
  written_at: string;
  updated_at: string;
  reporters: ReporterRow | null;
}

export const REPORTER_COLUMNS = "id, slug, name, bio, website, operator_name, trust, created_at";
const STORY_SELECT = `*, reporters(${REPORTER_COLUMNS})`;

export function toReporter(row: ReporterRow): Reporter {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    bio: row.bio,
    website: row.website,
    operatorName: row.operator_name,
    trust: row.trust,
    createdAt: row.created_at,
  };
}

/** A source's link as of now: a talk that has since landed in an event's
 * feed opens there, even in stories written before it did. */
function withCurrentLinks(sources: AskSource[]): AskSource[] {
  if (sources.length === 0) return sources;
  const byId = new Map(getVideosByIds(sources.map((s) => s.videoId)).map((v) => [v.id, v]));
  return sources.map((s) => {
    const v = byId.get(s.videoId);
    return v ? { ...s, watchUrl: videoLink(v) } : s;
  });
}

function toStory(row: StoryRow): Story {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    headline: row.headline,
    standfirst: row.standfirst,
    body: row.body,
    quotes: row.quotes ?? [],
    sources: withCurrentLinks(row.sources ?? []),
    externalSources: row.external_sources ?? [],
    eventKeys: row.event_keys ?? [],
    topic: row.topic,
    sourceVideoIds: row.source_video_ids ?? [],
    model: row.model,
    status: row.status,
    writtenAt: row.written_at,
    updatedAt: row.updated_at,
    reporter: row.reporters ? toReporter(row.reporters) : null,
  };
}

export function storiesConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// The service-role client: the only writer of these tables (RLS has no
// write policies), also used for reads so withdrawn/suspended rules are
// applied here in one place rather than split between RLS and code.
export const getAdmin = lazy(
  (): SupabaseClient =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
);

const STORIES_TAG = "stories";
const READ_TTL_SECONDS = 60;

/** Where a reporter's stories may appear. */
export function visibleOn(trust: ReporterTrust | undefined, place: "homepage" | "event" | "page"): boolean {
  if (!trust || trust === "suspended") return false;
  if (place === "homepage") return trust === "house" || trust === "trusted";
  return true;
}

function storiesQuery() {
  return getAdmin().from("stories").select(STORY_SELECT);
}

async function queryStories(
  build: (q: ReturnType<typeof storiesQuery>) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<Story[]> {
  if (!storiesConfigured()) return [];
  try {
    const { data, error } = await build(storiesQuery());
    if (error) throw error;
    return ((data as StoryRow[]) ?? [])
      .map(toStory)
      .filter((s) => s.status === "published" && s.reporter && s.reporter.trust !== "suspended");
  } catch (err) {
    console.error("[stories] read failed:", err);
    return [];
  }
}

/** The newest published stories from house and trusted reporters, for the
 * stories page (which groups them by event). */
export const listRecentStories = unstable_cache(
  async (limit: number): Promise<Story[]> => {
    const stories = await queryStories((q) =>
      q.eq("status", "published").order("written_at", { ascending: false }).limit(limit * 3)
    );
    return stories.filter((s) => visibleOn(s.reporter?.trust, "homepage")).slice(0, limit);
  },
  ["recent-stories"],
  { tags: [STORIES_TAG], revalidate: READ_TTL_SECONDS }
);

/** Published stories about any of these events, newest first. */
export const listStoriesForEvents = unstable_cache(
  async (eventKeys: string[], limit: number): Promise<Story[]> => {
    if (eventKeys.length === 0) return [];
    return queryStories((q) =>
      q.eq("status", "published").overlaps("event_keys", eventKeys).order("written_at", { ascending: false }).limit(limit)
    );
  },
  ["event-stories"],
  { tags: [STORIES_TAG], revalidate: READ_TTL_SECONDS }
);

/** One story by slug, including withdrawn ones (shown as withdrawn); null
 * for a suspended reporter's story or no such slug. */
export const getStory = unstable_cache(
  async (slug: string): Promise<Story | null> => {
    if (!storiesConfigured()) return null;
    const { data, error } = await getAdmin().from("stories").select(STORY_SELECT).eq("slug", slug).maybeSingle();
    if (error) {
      console.error("[stories] read failed:", error);
      return null;
    }
    if (!data) return null;
    const story = toStory(data as StoryRow);
    if (story.reporter?.trust === "suspended") return null;
    return story;
  },
  ["story"],
  { tags: [STORIES_TAG], revalidate: READ_TTL_SECONDS }
);

export interface StoryRevision {
  id: string;
  headline: string;
  standfirst: string;
  body: string;
  quotes: StoryQuote[];
  sources: AskSource[];
  externalSources: ExternalSource[];
  writtenAt: string;
  replacedAt: string;
}

/** Earlier versions of a story, newest first. */
export async function listRevisions(storyId: string): Promise<StoryRevision[]> {
  if (!storiesConfigured()) return [];
  const { data, error } = await getAdmin()
    .from("story_revisions")
    .select("*")
    .eq("story_id", storyId)
    .order("replaced_at", { ascending: false });
  if (error) {
    console.error("[stories] revisions read failed:", error);
    return [];
  }
  return (
    data as {
      id: string;
      headline: string;
      standfirst: string;
      body: string;
      quotes: StoryQuote[];
      sources: AskSource[];
      external_sources: ExternalSource[];
      written_at: string;
      replaced_at: string;
    }[]
  ).map((r) => ({
    id: r.id,
    headline: r.headline,
    standfirst: r.standfirst,
    body: r.body,
    quotes: r.quotes ?? [],
    sources: r.sources ?? [],
    externalSources: r.external_sources ?? [],
    writtenAt: r.written_at,
    replacedAt: r.replaced_at,
  }));
}

export const getReporter = unstable_cache(
  async (slug: string): Promise<Reporter | null> => {
    if (!storiesConfigured()) return null;
    const { data, error } = await getAdmin().from("reporters").select("*").eq("slug", slug).maybeSingle();
    if (error || !data) return null;
    const reporter = toReporter(data as ReporterRow);
    return reporter.trust === "suspended" ? null : reporter;
  },
  ["reporter"],
  { tags: [STORIES_TAG], revalidate: READ_TTL_SECONDS }
);

export const listStoriesByReporter = unstable_cache(
  async (reporterId: string, limit: number): Promise<Story[]> =>
    queryStories((q) =>
      q.eq("reporter_id", reporterId).eq("status", "published").order("written_at", { ascending: false }).limit(limit)
    ),
  ["reporter-stories"],
  { tags: [STORIES_TAG], revalidate: READ_TTL_SECONDS }
);

/** Reporters operated by one user, newest first. Not cached: it backs the
 * reporter's own management UI and MCP tools. */
export async function listReportersForUser(userId: string): Promise<Reporter[]> {
  if (!storiesConfigured()) return [];
  const { data, error } = await getAdmin()
    .from("reporters")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[stories] reporters read failed:", error);
    return [];
  }
  return (data as ReporterRow[]).map(toReporter);
}

export const MAX_REPORTERS_PER_USER = 5;

/** Submission limits (overridable by env), shared by the quota check and
 * the reporter guide. */
export function storyLimits() {
  return {
    submitsPerDay: Number(process.env.STORY_DAILY_LIMIT) || 10,
    updatesPerDay: Number(process.env.STORY_UPDATE_DAILY_LIMIT) || 30,
    siteSubmitsPerHour: Number(process.env.STORY_SITE_HOURLY_LIMIT) || 50,
  };
}

export function slugify(text: string, max = 80): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/g, "") || "story"
  );
}

/** Reporting is invite-only: only accounts whose email is in REPORTER_EMAILS
 * (comma-separated, any case) can create bylines and file stories. Unset,
 * nobody can — the house desk files with the service role, not through
 * this. Taking an email off the list stops that account filing; its
 * published stories stay up. */
function reporterEmails(): Set<string> {
  return new Set(
    (process.env.REPORTER_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function emailCanReport(email: string | null | undefined): boolean {
  return Boolean(email) && reporterEmails().has(email!.trim().toLowerCase());
}

/** The same check from a user id, for MCP calls (their auth carries only
 * the id). */
export async function userCanReport(userId: string): Promise<boolean> {
  if (!storiesConfigured()) return false;
  const { data, error } = await getAdmin().auth.admin.getUserById(userId);
  if (error) {
    console.error("[stories] looking up a reporter's account failed:", error);
    return false;
  }
  return emailCanReport(data.user?.email);
}

export const NOT_A_REPORTER =
  "Reporting is invite-only, and this account isn't on the list. Ask the StreamETH team to add your email.";

export type CreateReporterResult = { ok: true; reporter: Reporter } | { ok: false; error: string };

export async function createReporter(
  user: { id: string; email?: string | null },
  input: { name: string; operatorName: string; bio: string; website: string | null }
): Promise<CreateReporterResult> {
  if (!storiesConfigured()) return { ok: false, error: "Reporting isn't set up on this server." };
  if (!emailCanReport(user.email)) return { ok: false, error: NOT_A_REPORTER };
  const userId = user.id;
  const name = input.name.trim().slice(0, 60);
  const operatorName = input.operatorName.trim().slice(0, 60);
  const bio = input.bio.trim().slice(0, 500);
  const website = input.website?.trim() || null;
  if (!name) return { ok: false, error: "Give your reporter a name." };
  if (!operatorName) return { ok: false, error: "Say who runs it — your name or your team's, as it should appear in bylines." };
  if (website && !/^https?:\/\/\S+$/.test(website)) return { ok: false, error: "The website must start with https://." };

  const existing = await listReportersForUser(userId);
  if (existing.length >= MAX_REPORTERS_PER_USER) {
    return { ok: false, error: `You can run up to ${MAX_REPORTERS_PER_USER} reporters.` };
  }

  const base = slugify(name, 36).replace(/^-/, "") || "reporter";
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await getAdmin()
      .from("reporters")
      .insert({ user_id: userId, name, operator_name: operatorName, bio, website, slug })
      .select("*")
      .single();
    if (!error && data) {
      revalidateTag(STORIES_TAG, { expire: 0 });
      return { ok: true, reporter: toReporter(data as ReporterRow) };
    }
    // 23505: unique violation on slug — try another.
    if ((error as { code?: string } | null)?.code !== "23505") {
      console.error("[stories] creating reporter failed:", error);
      return { ok: false, error: "Couldn't create the reporter. Try again." };
    }
  }
  return { ok: false, error: "Couldn't find a free name for that reporter. Try a different name." };
}

/** Builds the citable source cards for a story from video ids — never from
 * what the writer claims a talk is. `excerpts` (by n) is the passage shown
 * on hover. */
export function buildSources(
  refs: { n: number; videoId: string }[],
  excerpts: Map<number, string> = new Map()
): AskSource[] {
  const byId = new Map(getVideosByIds([...new Set(refs.map((r) => r.videoId))]).map((v) => [v.id, v]));
  return refs.flatMap((r) => {
    const v = byId.get(r.videoId);
    if (!v) return [];
    return [sourceFor(v, r.n, excerpts.get(r.n) ?? "")];
  });
}

function sourceFor(v: UnifiedVideo, n: number, excerpt: string): AskSource {
  return {
    n,
    videoId: v.id,
    title: v.title,
    speakers: v.speakers,
    event: v.eventName,
    channel: v.orgName,
    date: v.publishedAt ? formatDateShort(v.publishedAt) : null,
    watchUrl: videoLink(v),
    coverImage: v.coverImage,
    excerpt,
  };
}

/** Runs the verify gate (lib/storyVerify.mjs) with each cited talk's real
 * speakers and transcript. */
export async function verifyDraft(draft: StoryDraft, options: { allowExternal: boolean }): Promise<string[]> {
  const ids = [...new Set((draft.sources ?? []).map((s) => s.videoId))];
  const videos = getVideosByIds(ids);
  const talks = new Map(
    await Promise.all(
      videos.map(async (v) => {
        const transcript = v.hasTranscript ? await getFullTranscript(v.id) : null;
        return [v.id, { title: v.title, speakers: v.speakers, transcript }] as const;
      })
    )
  );
  return verifyStory(draft, talks, options);
}

export interface SaveStoryInput extends StoryDraft {
  kind: StoryKind;
  eventKeys: string[];
  topic?: string | null;
  model?: string | null;
}

/** Inserts a verified story under a fresh slug based on its headline. */
export async function insertStory(
  reporter: Reporter,
  input: SaveStoryInput
): Promise<{ ok: true; story: Story } | { ok: false; error: string }> {
  const excerpts = new Map((input.quotes ?? []).map((q) => [q.n, q.text]));
  const sources = buildSources(input.sources, excerpts);
  const base = reporter.trust === "house" ? slugify(input.headline) : `${slugify(input.headline, 70)}-${reporter.slug}`.slice(0, 110);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await getAdmin()
      .from("stories")
      .insert({
        slug,
        reporter_id: reporter.id,
        kind: input.kind,
        headline: input.headline.trim(),
        standfirst: input.standfirst.trim(),
        body: input.body.trim(),
        quotes: input.quotes ?? [],
        sources,
        external_sources: input.externalSources ?? [],
        event_keys: input.eventKeys,
        topic: input.topic ?? null,
        source_video_ids: [...new Set(input.sources.map((s) => s.videoId))],
        model: input.model ?? null,
      })
      .select(STORY_SELECT)
      .single();
    if (!error && data) {
      revalidateTag(STORIES_TAG, { expire: 0 });
      if (reporter.trust === "new") {
        const { error: trustError } = await getAdmin().rpc("refresh_reporter_trust", {
          p_reporter_id: reporter.id,
          p_min_stories: TRUST_AFTER_STORIES,
        });
        if (trustError) console.error("[stories] trust refresh failed:", trustError);
      }
      return { ok: true, story: toStory(data as StoryRow) };
    }
    if ((error as { code?: string } | null)?.code !== "23505") {
      console.error("[stories] insert failed:", error);
      return { ok: false, error: "Couldn't save the story. Try again." };
    }
  }
  return { ok: false, error: "Couldn't find a free slug for that headline." };
}

/** Replaces a story's content, keeping its slug and saving the previous
 * version as a revision. */
export async function updateStory(
  story: Story,
  input: SaveStoryInput
): Promise<{ ok: true; story: Story } | { ok: false; error: string }> {
  const admin = getAdmin();
  const { error: revisionError } = await admin.from("story_revisions").insert({
    story_id: story.id,
    headline: story.headline,
    standfirst: story.standfirst,
    body: story.body,
    quotes: story.quotes,
    sources: story.sources,
    external_sources: story.externalSources,
    written_at: story.updatedAt,
  });
  if (revisionError) {
    console.error("[stories] saving revision failed:", revisionError);
    return { ok: false, error: "Couldn't save the story. Try again." };
  }
  const excerpts = new Map((input.quotes ?? []).map((q) => [q.n, q.text]));
  const { data, error } = await admin
    .from("stories")
    .update({
      kind: input.kind,
      headline: input.headline.trim(),
      standfirst: input.standfirst.trim(),
      body: input.body.trim(),
      quotes: input.quotes ?? [],
      sources: buildSources(input.sources, excerpts),
      external_sources: input.externalSources ?? [],
      event_keys: input.eventKeys,
      topic: input.topic ?? null,
      source_video_ids: [...new Set(input.sources.map((s) => s.videoId))],
      model: input.model ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", story.id)
    .select(STORY_SELECT)
    .single();
  if (error || !data) {
    console.error("[stories] update failed:", error);
    return { ok: false, error: "Couldn't save the story. Try again." };
  }
  revalidateTag(STORIES_TAG, { expire: 0 });
  return { ok: true, story: toStory(data as StoryRow) };
}

export async function withdrawStory(storyId: string): Promise<boolean> {
  const { error } = await getAdmin()
    .from("stories")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", storyId);
  if (error) {
    console.error("[stories] withdraw failed:", error);
    return false;
  }
  revalidateTag(STORIES_TAG, { expire: 0 });
  return true;
}

/** Fresh (uncached) story by slug, for writes. */
export async function getStoryForWrite(slug: string): Promise<Story | null> {
  if (!storiesConfigured()) return null;
  const { data, error } = await getAdmin().from("stories").select(STORY_SELECT).eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return toStory(data as StoryRow);
}

export async function consumeStoryQuota(reporterId: string, action: "submit" | "update"): Promise<"ok" | "limited" | "unavailable"> {
  const { data, error } = await getAdmin().rpc("consume_story_quota", {
    p_reporter_id: reporterId,
    p_action: action,
    p_daily_limit: action === "submit" ? storyLimits().submitsPerDay : storyLimits().updatesPerDay,
    p_site_hourly_limit: storyLimits().siteSubmitsPerHour,
  });
  if (error) {
    console.error("[stories] quota check failed:", error);
    return "unavailable";
  }
  return data === true ? "ok" : "limited";
}

export async function reportStory(
  storyId: string,
  userId: string,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = reason.trim().slice(0, 1000);
  if (text.length < 5) return { ok: false, error: "Say what's wrong — a few words is enough." };
  const { error } = await getAdmin().from("story_reports").insert({ story_id: storyId, user_id: userId, reason: text });
  if (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, error: "You've already reported this story." };
    console.error("[stories] report failed:", error);
    return { ok: false, error: "Couldn't send the report. Try again." };
  }
  return { ok: true };
}

/** Open mistake reports for a set of stories — shown on the reporter page. */
export async function countOpenReports(storyIds: string[]): Promise<number> {
  if (!storiesConfigured() || storyIds.length === 0) return 0;
  const { count, error } = await getAdmin()
    .from("story_reports")
    .select("id", { count: "exact", head: true })
    .in("story_id", storyIds)
    .is("dismissed_at", null);
  if (error) return 0;
  return count ?? 0;
}
