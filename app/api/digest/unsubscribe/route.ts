import { digestConfigured, unsubscribe } from "@/lib/digest";

/** One-click unsubscribe (RFC 8058): mail clients POST to the
 * List-Unsubscribe URL without opening a page. */
export async function POST(request: Request) {
  if (!digestConfigured()) return new Response(null, { status: 503 });
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    const ok = await unsubscribe(token);
    return new Response(null, { status: ok ? 200 : 404 });
  } catch (err) {
    console.error("[digest] one-click unsubscribe failed:", err);
    return new Response(null, { status: 500 });
  }
}
