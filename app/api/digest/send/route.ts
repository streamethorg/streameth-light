import { digestConfigured, sendWeeklyDigest } from "@/lib/digest";

/** Weekly digest send, triggered by a crontab entry on the VPS (see
 * scripts/deploy-vps.sh) that sends `Authorization: Bearer $CRON_SECRET`. */
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
