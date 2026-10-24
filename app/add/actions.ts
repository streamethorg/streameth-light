"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addEmbed, removeEmbed, type AddEmbedResult } from "@/lib/embeds";

/** Adds a link to an event's feed under one of the signed-in user's
 * reporters. All the checks live in lib/embeds.ts's addEmbed. */
export async function addEmbedAction(input: {
  reporterSlug: string;
  eventKey: string;
  url: string;
  note: string;
}): Promise<AddEmbedResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out. Sign in again to add media." };

  const result = await addEmbed({ userId: user.id, email: user.email ?? null }, input);
  if (result.ok) refresh();
  return result;
}

export async function removeEmbedAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const result = await removeEmbed(user.id, id);
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true };
}
