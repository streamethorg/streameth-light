import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import { cache } from "react";
import { createClient } from "./supabase/server";
import {
  cleanNote,
  isPrivateAddress,
  matchMedia,
  oembedFields,
  oembedUrl,
  parseOpenGraph,
  type MediaFields,
  type MediaMatch,
} from "./embedCore.mjs";
import { getSeasonEvent } from "./season";
import {
  emailCanReport,
  getAdmin,
  listReportersForUser,
  NOT_A_REPORTER,
  REPORTER_COLUMNS,
  storiesConfigured,
  toReporter,
  userCanReport,
  type Reporter,
  type ReporterRow,
} from "./stories";

/** Media reporters add to an event's feed by link (migration 11): a
 * provider's player (YouTube, X, Vimeo, TikTok, Spotify, SoundCloud) or a
 * link card for any other page. We keep the link and a few fields about it,
 * never the media. Read fresh on every event page view (one indexed query,
 * deduped per request) so an add or a remove shows at once. */

export interface Embed {
  id: string;
  reporter: Reporter;
  eventKey: string;
  provider: MediaMatch["provider"];
  externalId: string | null;
  url: string;
  variant: string | null;
  title: string;
  description: string;
  authorName: string | null;
  authorUrl: string | null;
  siteName: string | null;
  imageUrl: string | null;
  note: string;
  createdAt: string;
}

interface EmbedRow {
  id: string;
  reporter_id: string;
  event_key: string;
  provider: MediaMatch["provider"];
  external_id: string | null;
  url: string;
  variant: string | null;
  title: string;
  description: string;
  author_name: string | null;
  author_url: string | null;
  site_name: string | null;
  image_url: string | null;
  note: string;
  created_at: string;
  reporters: ReporterRow | null;
}

const EMBED_SELECT = `id, reporter_id, event_key, provider, external_id, url, variant, title, description, author_name, author_url, site_name, image_url, note, created_at, reporters(${REPORTER_COLUMNS})`;
const FETCH_TIMEOUT_MS = 5000;
const MAX_PAGE_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = "StreamETHBot/1.0 (+https://streameth.org)";

/** Null when the reporter is gone, or suspended (unless the operator is
 * looking at their own). */
function toEmbed(row: EmbedRow, includeSuspended = false): Embed | null {
  if (!row.reporters || (row.reporters.trust === "suspended" && !includeSuspended)) return null;
  return {
    id: row.id,
    reporter: toReporter(row.reporters),
    eventKey: row.event_key,
    provider: row.provider,
    externalId: row.external_id,
    url: row.url,
    variant: row.variant,
    title: row.title,
    description: row.description,
    authorName: row.author_name,
    authorUrl: row.author_url,
    siteName: row.site_name,
    imageUrl: row.image_url,
    note: row.note,
    createdAt: row.created_at,
  };
}

/** Embeds in these events' feeds, newest first. Visibility by the
 * reporter's trust is the caller's (`visibleOn`), as for stories. */
export const listEmbedsForEvents = cache(
  async (eventKeys: string[], limit: number): Promise<Embed[]> => {
    if (eventKeys.length === 0 || !storiesConfigured()) return [];
    try {
      const { data, error } = await getAdmin()
        .from("event_embeds")
        .select(EMBED_SELECT)
        .in("event_key", eventKeys)
        .is("removed_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data as unknown as EmbedRow[]) ?? []).map((row) => toEmbed(row)).filter((e): e is Embed => e !== null);
    } catch (err) {
      console.error("[embeds] read failed:", err);
      return [];
    }
  }
);

/** Embeds the user's reporters have added, newest first — for /add and the
 * MCP `list_my_embeds` tool. */
export async function listEmbedsForUser(userId: string, limit = 100): Promise<Embed[]> {
  if (!storiesConfigured()) return [];
  const reporters = await listReportersForUser(userId);
  if (reporters.length === 0) return [];
  const { data, error } = await getAdmin()
    .from("event_embeds")
    .select(EMBED_SELECT)
    .in(
      "reporter_id",
      reporters.map((r) => r.id)
    )
    .is("removed_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[embeds] read failed:", error);
    return [];
  }
  // A suspended reporter's embeds are still the operator's to see and remove.
  return ((data as unknown as EmbedRow[]) ?? []).map((row) => toEmbed(row, true)).filter((e): e is Embed => e !== null);
}

/** Whether the signed-in visitor can add media (on the reporter list, runs
 * an active reporter) — for the event page's "Add to feed" button. */
export async function viewerCanAddMedia(): Promise<boolean> {
  if (!storiesConfigured()) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !emailCanReport(user.email)) return false;
    return (await listReportersForUser(user.id)).some((r) => r.trust !== "suspended");
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ fetching

class FetchError extends Error {}

/** DNS lookup that refuses private and internal addresses — checked at
 * connect time, so a hostname can't pass the check and then resolve
 * somewhere else (DNS rebinding). */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true })
    .then((addresses) => {
      const safe = addresses.filter((a) => !isPrivateAddress(a.address));
      if (safe.length === 0 || safe.length !== addresses.length) {
        callback(new FetchError(`refused address for ${hostname}`), "", 4);
        return;
      }
      if (options.all) {
        (callback as unknown as (err: null, addresses: { address: string; family: number }[]) => void)(null, safe);
      } else {
        callback(null, safe[0].address, safe[0].family);
      }
    })
    .catch((err: Error) => callback(err, "", 4));
};

interface Page {
  url: string;
  contentType: string;
  body: string;
}

function getOnce(url: string): Promise<{ status: number; location: string | null; contentType: string; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        lookup: publicOnlyLookup,
        timeout: FETCH_TIMEOUT_MS,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers["content-type"] ?? "");
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, location, contentType, body: "" });
          return;
        }
        if (!/text\/html|application\/xhtml/i.test(contentType)) {
          res.destroy();
          resolve({ status, location, contentType, body: "" });
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          chunks.push(chunk);
          // Only <head> matters; stop once we have enough.
          if (size >= MAX_PAGE_BYTES) res.destroy();
        });
        const done = () => resolve({ status, location, contentType, body: Buffer.concat(chunks).toString("utf-8") });
        res.on("end", done);
        res.on("close", done);
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new FetchError("timed out")));
    req.on("error", reject);
    req.end();
  });
}

/** GET a public https page for its <head>: our own DNS check on every hop,
 * at most 3 redirects (each must stay https), 5 s per hop, 512 KB. */
async function fetchPage(startUrl: string): Promise<Page> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await getOnce(url);
    if (res.status >= 300 && res.status < 400 && res.location) {
      const next = new URL(res.location, url);
      if (next.protocol !== "https:" || next.port || next.username) throw new FetchError("unsafe redirect");
      url = next.toString();
      continue;
    }
    if (res.status >= 400) throw new FetchError(`status ${res.status}`);
    return { url, contentType: res.contentType, body: res.body };
  }
  throw new FetchError("too many redirects");
}

/** A provider's oEmbed response, or why we couldn't get it. Providers
 * answer 400/401/403/404 for unknown, private, deleted or
 * embedding-disabled media (YouTube: 400 for an id that doesn't exist). */
async function fetchOembed(endpoint: string): Promise<{ ok: true; json: unknown } | { ok: false; reason: "private" | "down" }> {
  try {
    const res = await fetch(endpoint, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if ([400, 401, 403, 404].includes(res.status)) return { ok: false, reason: "private" };
    if (!res.ok) return { ok: false, reason: "down" };
    return { ok: true, json: await res.json() };
  } catch {
    return { ok: false, reason: "down" };
  }
}

const PROVIDER_NAME: Record<string, string> = {
  youtube: "YouTube",
  x: "X",
  vimeo: "Vimeo",
  tiktok: "TikTok",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
};

type Resolved = { ok: true; match: MediaMatch; fields: MediaFields } | { ok: false; error: string };

/** What a link is and what to show for it: the provider's oEmbed fields, or
 * a link card from the page. A link that redirects to a known provider
 * (t.co → x.com) is treated as that provider. */
async function resolveMedia(match: MediaMatch, followed = false): Promise<Resolved> {
  const endpoint = oembedUrl(match);
  if (endpoint) {
    const res = await fetchOembed(endpoint);
    const name = PROVIDER_NAME[match.provider] ?? match.provider;
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.reason === "private"
            ? `That ${name} link isn't public or can't be embedded.`
            : `Couldn't reach ${name}. Try again in a minute.`,
      };
    }
    const fields = oembedFields(match.provider, res.json);
    if (!fields) return { ok: false, error: `${name} didn't return anything we can show for that link.` };
    return { ok: true, match, fields };
  }

  let page: Page;
  try {
    page = await fetchPage(match.canonicalUrl);
  } catch (err) {
    console.warn("[embeds] link preview failed:", match.canonicalUrl, err instanceof Error ? err.message : err);
    return { ok: false, error: "Couldn't load that page to preview it. Check the link is public and try again." };
  }
  if (!followed && page.url !== match.canonicalUrl) {
    const landed = matchMedia(page.url);
    if (landed && landed.provider !== "link") return resolveMedia(landed, true);
  }
  const final = matchMedia(page.url) ?? match;
  if (!page.body) {
    // Not HTML (a PDF, an image): a bare card with the address.
    const host = new URL(final.canonicalUrl).hostname.replace(/^www\./, "");
    return {
      ok: true,
      match: final,
      fields: { title: host, description: "", authorName: null, authorUrl: null, siteName: host, imageUrl: null },
    };
  }
  return { ok: true, match: final, fields: parseOpenGraph(page.body, final.canonicalUrl) };
}

// ------------------------------------------------------------------ writes

export type AddEmbedResult =
  | { ok: true; embed: { id: string; provider: string; title: string; eventUrl: string } }
  | { ok: false; error: string };

export interface AddEmbedInput {
  reporterSlug: string;
  eventKey: string;
  url: string;
  note?: string;
}

/** Who's adding: a signed-in web user (we have their email) or an MCP
 * caller (only their user id). */
export type EmbedActor = { userId: string; email?: string | null };

async function actorCanReport(actor: EmbedActor): Promise<boolean> {
  return actor.email !== undefined ? emailCanReport(actor.email) : userCanReport(actor.userId);
}

/** Adds a link to an event's feed under one of the actor's reporters.
 * Checks, in order: reporting set up, on the reporter list, runs the
 * reporter (not suspended), the event has a page, the link is one we can
 * show, not already in that event, the provider says it's public. */
export async function addEmbed(actor: EmbedActor, input: AddEmbedInput): Promise<AddEmbedResult> {
  if (!storiesConfigured()) return { ok: false, error: "Reporting isn't set up on this server." };
  if (!(await actorCanReport(actor))) return { ok: false, error: NOT_A_REPORTER };

  const reporters = await listReportersForUser(actor.userId);
  const reporter = reporters.find((r) => r.slug === input.reporterSlug);
  if (!reporter) {
    return {
      ok: false,
      error: reporters.length
        ? `You don't run a reporter "${input.reporterSlug}". Yours: ${reporters.map((r) => r.slug).join(", ")}.`
        : "Create a reporter first, on the Connect page.",
    };
  }
  if (reporter.trust === "suspended") return { ok: false, error: `Reporter "${reporter.slug}" is suspended.` };

  const event = getSeasonEvent(input.eventKey);
  if (!event?.href) return { ok: false, error: "Pick an event that has a coverage page." };

  const match = matchMedia(input.url);
  if (!match) return { ok: false, error: "Paste a full https link, like https://youtu.be/… or https://x.com/…/status/…" };

  const resolved = await resolveMedia(match);
  if (!resolved.ok) return resolved;
  const { match: final, fields } = resolved;

  const { data, error } = await getAdmin()
    .from("event_embeds")
    .insert({
      reporter_id: reporter.id,
      user_id: actor.userId,
      event_key: event.key,
      provider: final.provider,
      external_id: final.externalId,
      url: final.canonicalUrl,
      variant: final.variant,
      title: fields.title,
      description: fields.description,
      author_name: fields.authorName,
      author_url: fields.authorUrl,
      site_name: fields.siteName,
      image_url: fields.imageUrl,
      note: cleanNote(input.note),
    })
    .select("id")
    .single();
  if (error) {
    // 23505: the unique (event_key, url) index — already in this feed.
    if ((error as { code?: string }).code === "23505") return { ok: false, error: `That's already in ${event.name}'s feed.` };
    console.error("[embeds] insert failed:", error);
    return { ok: false, error: "Couldn't save that. Try again." };
  }
  return {
    ok: true,
    embed: { id: (data as { id: string }).id, provider: final.provider, title: fields.title, eventUrl: event.href },
  };
}

/** Takes an embed out of its feed. Only the operator of the reporter that
 * added it can; works even after they've left the reporter list. */
export async function removeEmbed(userId: string, embedId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!storiesConfigured()) return { ok: false, error: "Reporting isn't set up on this server." };
  if (!/^[0-9a-f-]{36}$/i.test(embedId)) return { ok: false, error: "No such item." };
  const reporters = await listReportersForUser(userId);
  if (reporters.length === 0) return { ok: false, error: "No such item." };
  const { data, error } = await getAdmin()
    .from("event_embeds")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", embedId)
    .in(
      "reporter_id",
      reporters.map((r) => r.id)
    )
    .is("removed_at", null)
    .select("id");
  if (error) {
    console.error("[embeds] remove failed:", error);
    return { ok: false, error: "Couldn't remove it. Try again." };
  }
  if (!data || data.length === 0) return { ok: false, error: "No such item." };
  return { ok: true };
}
