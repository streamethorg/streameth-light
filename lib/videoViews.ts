import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lazy } from "./lazy";
import type { ViewReport } from "./viewTracking";

/** Video watch analytics in Supabase's video_views table (see migration
 * …05_video_views.sql). Needs SUPABASE_SERVICE_ROLE_KEY. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIDEO_ID_RE = /^[\w-]{1,64}$/;
// Longer than any talk in the archive; anything above is a forged report.
const MAX_SECONDS = 24 * 60 * 60;

export function viewsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const getAdmin = lazy(
  (): SupabaseClient =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
);

function seconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.round(value), MAX_SECONDS);
}

/** Validates a report from the browser; null if it's malformed. */
export function parseViewReport(body: unknown): ViewReport | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.id !== "string" || !UUID_RE.test(b.id)) return null;
  if (typeof b.videoId !== "string" || !VIDEO_ID_RE.test(b.videoId)) return null;
  if (b.source !== "streameth" && b.source !== "youtube") return null;
  if (b.mode !== "video" && b.mode !== "audio") return null;
  const watched = seconds(b.watched);
  const position = seconds(b.position);
  if (watched === null || position === null) return null;
  const duration = seconds(b.duration);
  return {
    id: b.id,
    videoId: b.videoId,
    source: b.source,
    mode: b.mode,
    watched,
    position,
    duration: duration && duration > 0 ? duration : null,
    first: b.first === true,
  };
}

export async function recordView(report: ViewReport, userId: string | null): Promise<void> {
  const { error } = await getAdmin().rpc("record_video_view", {
    p_id: report.id,
    p_video_id: report.videoId,
    p_source: report.source,
    p_mode: report.mode,
    p_user_id: userId,
    p_watched_seconds: report.watched,
    p_max_position: report.position,
    p_duration: report.duration,
  });
  if (error) throw error;
}
