import type { User } from "@supabase/supabase-js";

/** How people sign in: an emailed one-time code (or the magic link in the
 * same email) or Google. Leftover wallet accounts from the earlier wallet
 * sign-in have neither and are treated as signed out where it matters (MCP). */
export const SIGN_IN_PROVIDERS = ["email", "google"] as const;

export function hasSignInProvider(providers: unknown): boolean {
  return (
    Array.isArray(providers) &&
    providers.some((p) => (SIGN_IN_PROVIDERS as readonly unknown[]).includes(p))
  );
}

function metadataString(user: User, key: string): string | null {
  const value: unknown = user.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The name to show for an account: the Google profile name, else the email. */
export function accountName(user: User): string {
  return metadataString(user, "full_name") ?? metadataString(user, "name") ?? user.email ?? "Your account";
}

/** The Google profile photo, if the account has one. */
export function accountPhoto(user: User): string | null {
  return metadataString(user, "avatar_url") ?? metadataString(user, "picture");
}

// Only same-origin paths — `next` comes from the URL, so "//evil.com" or
// "https://…" must not become a post-sign-in redirect.
export function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/";
}
