"use server";

import { createClient } from "@/lib/supabase/server";
import { reportStory } from "@/lib/stories";

export type ReportResult = { ok: true } | { ok: false; error: string; signIn?: boolean };

/** "Report a mistake" on a story. Signed-in readers only, one report per
 * reader per story; an open report holds a new reporter back from trust. */
export async function reportMistake(storyId: string, reason: string): Promise<ReportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to report a mistake.", signIn: true };
  return reportStory(storyId, user.id, reason);
}
