import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // api/views gets a progress report every few seconds per viewer and reads
  // the session itself; api/auth/send-email is called by Supabase, not a
  // browser. Neither needs the per-request token refresh.
  matcher: ["/((?!api/mcp|api/views|api/auth/send-email|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xml|md)$).*)"],
};
