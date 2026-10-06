import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!api/mcp|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xml|md)$).*)"],
};
