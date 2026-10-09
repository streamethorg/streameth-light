import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/account";

/** Where Google sign-in and the magic link in the sign-in email land: swaps
 * the one-time `code` for a session cookie, then continues to `next`. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("[auth] code exchange failed:", error);
  } else if (url.searchParams.get("error")) {
    console.error("[auth] provider returned an error:", url.searchParams.get("error_description"));
  }

  const signin = new URL("/signin", url.origin);
  signin.searchParams.set("next", next);
  signin.searchParams.set("failed", "1");
  return NextResponse.redirect(signin);
}
