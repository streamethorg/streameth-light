import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { lazy } from "../lazy";
import { hashMcpToken, isMcpToken } from "../mcpTokens";

/** Supabase Auth's OAuth 2.1 server issues the MCP access tokens; its issuer
 * is the project's `/auth/v1` URL. */
export function supabaseAuthIssuer(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
}

// A stateless client: MCP requests carry a bearer token, not cookies, so
// there's no session to persist or refresh.
const getClient = lazy(() =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
);

/** Verifies an MCP bearer token — either a personal token generated on
 * /connect, or a Supabase OAuth access token (signature + expiry) — and maps
 * it to the MCP SDK's AuthInfo. Returns undefined for anything that isn't a
 * signed-in user's token, so `withMcpAuth` answers 401 with the OAuth
 * challenge. */
export async function verifySupabaseToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return undefined;
  }

  if (isMcpToken(bearerToken)) {
    const { data: userId, error } = await getClient().rpc("verify_mcp_token", {
      p_token_hash: hashMcpToken(bearerToken),
    });
    if (error) {
      console.error("[mcp] personal token lookup failed:", error);
      return undefined;
    }
    if (typeof userId !== "string") return undefined;
    return { token: bearerToken, clientId: "personal-token", scopes: [], extra: { userId } };
  }

  const { data, error } = await getClient().auth.getClaims(bearerToken);
  if (error || !data) return undefined;

  const { claims } = data;
  // The anon key is itself a valid project JWT (role "anon", no user) —
  // only accept tokens minted for an actual signed-in user.
  if (claims.role !== "authenticated" || !claims.sub) return undefined;
  // Accounts are wallets: reject leftover email-only accounts. app_metadata
  // is set by Supabase Auth (not user-writable) and signed into the token.
  const providers: unknown = claims.app_metadata?.providers;
  if (!Array.isArray(providers) || !providers.includes("web3")) return undefined;

  const clientId = typeof claims.client_id === "string" ? claims.client_id : "";
  const scopes = typeof claims.scope === "string" ? claims.scope.split(" ").filter(Boolean) : [];

  return {
    token: bearerToken,
    clientId,
    scopes,
    expiresAt: claims.exp,
    extra: { userId: claims.sub },
  };
}
