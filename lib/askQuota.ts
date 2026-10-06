import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { lazy } from "./lazy";

const HOURLY_LIMIT = Number(process.env.ASK_HOURLY_LIMIT) || 20;
const DAILY_LIMIT = Number(process.env.ASK_DAILY_LIMIT) || 2000;

const getClient = lazy(() =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
);

/** Counts one question against the per-user hourly and site-wide daily
 * limits (see the consume_ask_quota migration). "unavailable" means the
 * check itself couldn't run — in production the route refuses rather than
 * spend without a limit. */
export async function consumeAskQuota(userId: string): Promise<"ok" | "limited" | "unavailable"> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (process.env.NODE_ENV === "development") return "ok";
    return "unavailable";
  }
  const { data, error } = await getClient().rpc("consume_ask_quota", {
    p_client_hash: createHash("sha256").update(userId).digest("hex"),
    p_hourly_limit: HOURLY_LIMIT,
    p_daily_limit: DAILY_LIMIT,
  });
  if (error) {
    console.error("[ask] quota check failed:", error);
    // Locally the migration may not be applied yet; don't block development.
    return process.env.NODE_ENV === "development" ? "ok" : "unavailable";
  }
  return data === true ? "ok" : "limited";
}
