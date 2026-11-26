import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/account";

/** The address the visitor actually used. Behind a reverse proxy, `request.url`
 * is the server's own address (http://localhost:3000), so prefer the
 * forwarded host the proxy passes along. */
function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (!host) return url.origin;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** Where Google sign-in and the magic link in the sign-in email land: swaps
 * the one-time `code` for a session cookie, then continues to `next`. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth] code exchange failed:", error);
  } else if (url.searchParams.get("error")) {
    console.error("[auth] provider returned an error:", url.searchParams.get("error_description"));
  }

  const signin = new URL("/signin", origin);
  signin.searchParams.set("next", next);
  signin.searchParams.set("failed", "1");
  return NextResponse.redirect(signin);
}
