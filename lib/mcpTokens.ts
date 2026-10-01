import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Personal MCP tokens look like `smcp_<43 base64url chars>` (32 random
 * bytes). The prefix lets /api/mcp tell them apart from OAuth access tokens
 * (JWTs) without trying both. */
export const MCP_TOKEN_PREFIX = "smcp_";

/** Most tokens a user can hold at once — one per app/device is plenty. */
export const MAX_MCP_TOKENS = 10;

export function generateMcpToken(): string {
  return MCP_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

/** Tokens are 256-bit random, so a plain SHA-256 (no salt/KDF) is enough to
 * make a leaked hash useless. */
export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isMcpToken(value: string): boolean {
  return value.startsWith(MCP_TOKEN_PREFIX);
}
