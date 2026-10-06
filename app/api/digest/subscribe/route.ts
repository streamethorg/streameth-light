import { digestConfigured, normalizeEmail, requestSubscription } from "@/lib/digest";

export async function POST(request: Request) {
  if (!digestConfigured()) {
    return Response.json({ error: "The email digest isn't set up on this deployment." }, { status: 503 });
  }

  let email: string | null = null;
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? normalizeEmail(body.email) : null;
  } catch {
    email = null;
  }
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    await requestSubscription(email);
  } catch (err) {
    console.error("[digest] subscribe failed:", err);
    return Response.json({ error: "Couldn't subscribe right now. Try again later." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
