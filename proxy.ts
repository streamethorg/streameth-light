import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // api/views gets a progress report every few seconds per viewer; it reads
  // the session itself, so skip the per-request token refresh there.
  matcher: ["/((?!api/mcp|api/views|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xml|md)$).*)"],
};
