import {
  authEmailConfigured,
  parseHookPayload,
  sendAuthEmail,
  UnsupportedAuthEmailError,
  verifyHookSignature,
} from "@/lib/authEmail";

// Supabase Auth reads this error shape and shows `message` in its logs.
function hookError(message: string, status: number) {
  return Response.json({ error: { http_code: status, message } }, { status });
}

/** Supabase Auth's Send Email hook (lib/authEmail.ts). */
export async function POST(request: Request) {
  if (!authEmailConfigured()) return hookError("Auth email isn't set up on this deployment.", 503);

  const body = await request.text();
  if (!verifyHookSignature(request.headers, body)) return hookError("Invalid signature.", 401);

  const payload = parseHookPayload(body);
  if (!payload) return hookError("Invalid payload.", 400);

  try {
    await sendAuthEmail(payload);
  } catch (err) {
    if (err instanceof UnsupportedAuthEmailError) return hookError(err.message, 400);
    console.error("[auth] sending email failed:", err);
    return hookError("Couldn't send the email.", 500);
  }
  return Response.json({});
}
