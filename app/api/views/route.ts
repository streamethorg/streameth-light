import { createClient } from "@/lib/supabase/server";
import { parseViewReport, recordView, viewsConfigured } from "@/lib/videoViews";

/** Records watch progress sent by the players (lib/viewTracking.ts) —
 * usually through navigator.sendBeacon, which ignores the response. */
export async function POST(request: Request) {
  if (!viewsConfigured()) return new Response(null, { status: 204 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const report = parseViewReport(body);
  if (!report) return Response.json({ error: "Invalid view report." }, { status: 400 });

  // Only the first report of a view needs the viewer; later ones keep it.
  let userId: string | null = null;
  if (report.first) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    userId = typeof data?.claims.sub === "string" ? data.claims.sub : null;
  }

  try {
    await recordView(report, userId);
  } catch (err) {
    console.error("[views] record failed:", err);
    return Response.json({ error: "Couldn't record the view." }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
