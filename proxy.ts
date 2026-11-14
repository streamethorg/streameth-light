import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Old-site topic filters (/?topic=ethereum, /?topic=Science%20%26%20Technology)
// still collect impressions as "streameth" sitelinks; the homepage ignores
// the parameter, so send them to the topic page. Same slug rule as
// lib/topics.ts (server-only, so not importable here).
const TOPIC_ALIASES: Record<string, string> = { "science-technology": "technology" };

function legacyTopicRedirect(request: NextRequest): NextResponse | undefined {
  const { pathname, searchParams } = request.nextUrl;
  const topic = searchParams.get("topic")?.trim();
  if (pathname !== "/" || !topic) return undefined;
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const target = slug ? `/topics/${TOPIC_ALIASES[slug] ?? slug}` : "/topics";
  return NextResponse.redirect(new URL(target, request.url), 301);
}

export async function proxy(request: NextRequest) {
  return legacyTopicRedirect(request) ?? (await updateSession(request));
}

export const config = {
  // api/views gets a progress report every few seconds per viewer and reads
  // the session itself; api/auth/send-email is called by Supabase, not a
  // browser. Neither needs the per-request token refresh.
  matcher: ["/((?!api/mcp|api/views|api/auth/send-email|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xml|md)$).*)"],
};
