import { digestConfigured, sendWeeklyDigest } from "@/lib/digest";

export const maxDuration = 300;

/** Weekly digest send, triggered by the Vercel cron in vercel.json. Vercel
 * sends `Authorization: Bearer $CRON_SECRET` with cron requests. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!digestConfigured()) {
    return Response.json({ error: "Digest not configured" }, { status: 503 });
  }
  try {
    const result = await sendWeeklyDigest();
    console.log("[digest] weekly send:", result);
    return Response.json(result);
  } catch (err) {
    console.error("[digest] weekly send failed:", err);
    return Response.json({ error: "Send failed" }, { status: 500 });
  }
}
