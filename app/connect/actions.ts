"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_MCP_TOKENS, generateMcpToken, hashMcpToken } from "@/lib/mcpTokens";

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
