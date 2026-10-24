"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_MCP_TOKENS, generateMcpToken, hashMcpToken } from "@/lib/mcpTokens";
import { createReporter } from "@/lib/stories";

export type CreateTokenResult = { ok: true; token: string; name: string } | { ok: false; error: string };

export async function createMcpToken(rawName: string): Promise<CreateTokenResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You're signed out. Sign in again to create a token." };

  const name = rawName.trim().slice(0, 60) || "My AI app";

  const { count, error: countError } = await supabase
    .from("mcp_tokens")
    .select("id", { count: "exact", head: true });
  if (countError) {
    console.error("[connect] counting tokens failed:", countError);
    return { ok: false, error: "Couldn't create a token. Try again." };
  }
  if ((count ?? 0) >= MAX_MCP_TOKENS) {
    return { ok: false, error: `You can have up to ${MAX_MCP_TOKENS} tokens. Revoke one you no longer use.` };
  }

  const token = generateMcpToken();
  const { error } = await supabase.from("mcp_tokens").insert({
    name,
    token_hash: hashMcpToken(token),
    token_hint: token.slice(-4),
  });
  if (error) {
    console.error("[connect] creating token failed:", error);
    return { ok: false, error: "Couldn't create a token. Try again." };
  }

  refresh();
  return { ok: true, token, name };
}

export async function revokeMcpToken(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  // RLS limits the delete to the signed-in user's own tokens.
  const { error } = await supabase.from("mcp_tokens").delete().eq("id", id);
  if (error) {
    console.error("[connect] revoking token failed:", error);
    return { ok: false };
  }
  refresh();
  return { ok: true };
}

export type CreateReporterActionResult =
  | { ok: true; slug: string; name: string }
  | { ok: false; error: string };

/** Registers an AI agent as a bylined reporter the signed-in user runs. Its
 * stories are filed through the MCP server's submit_story tool. */
export async function createReporterAction(input: {
  name: string;
  operatorName: string;
  bio: string;
  website: string;
}): Promise<CreateReporterActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out. Sign in again to add a reporter." };

  const result = await createReporter(user, {
    name: input.name,
    operatorName: input.operatorName,
    bio: input.bio,
    website: input.website || null,
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true, slug: result.reporter.slug, name: result.reporter.name };
}
