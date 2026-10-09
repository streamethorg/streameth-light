import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_NAME } from "./social";
import { emailConfigured, emailLayout, escapeHtml, sendEmail } from "./email";

/** Supabase Auth's "Send Email" hook: instead of using SMTP, Supabase POSTs
 * each auth email to /api/auth/send-email, signed per the Standard Webhooks
 * spec with SEND_EMAIL_HOOK_SECRET ("v1,whsec_…", the value Supabase shows
 * for the hook), and we send it through Resend like the digest. */

const TOLERANCE_SECONDS = 5 * 60;

export function authEmailConfigured(): boolean {
  return Boolean(process.env.SEND_EMAIL_HOOK_SECRET && process.env.NEXT_PUBLIC_SUPABASE_URL && emailConfigured());
}

/** Checks the webhook-id/-timestamp/-signature headers against the raw body. */
export function verifyHookSignature(headers: Headers, body: string, now = Date.now()): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now / 1000 - sentAt) > TOLERANCE_SECONDS) return false;

  const secret = (process.env.SEND_EMAIL_HOOK_SECRET ?? "").replace(/^v1,/, "").replace(/^whsec_/, "");
  if (!secret) return false;
  const expected = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest();

  // The header can hold several space-separated "v1,<base64>" signatures.
  return signatures.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export interface SendEmailHookPayload {
  user: { email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
  };
}

export function parseHookPayload(body: string): SendEmailHookPayload | null {
  try {
    const data = JSON.parse(body) as Partial<SendEmailHookPayload>;
    const e = data.email_data;
    if (
      typeof data.user?.email !== "string" ||
      !e ||
      typeof e.token !== "string" ||
      typeof e.token_hash !== "string" ||
      typeof e.email_action_type !== "string"
    ) {
      return null;
    }
    return data as SendEmailHookPayload;
  } catch {
    return null;
  }
}

// Every way the app signs someone in (an emailed code, its magic link, a
// first sign-in that creates the account) sends one of these.
const SIGN_IN_ACTIONS = new Set(["magiclink", "signup", "email", "invite"]);

export class UnsupportedAuthEmailError extends Error {}

export async function sendAuthEmail({ user, email_data: data }: SendEmailHookPayload): Promise<void> {
  const to = user.email!;
  const code = escapeHtml(data.token);

  if (data.email_action_type === "reauthentication") {
    await sendEmail({
      to,
      subject: `Your ${SITE_NAME} confirmation code`,
      html: emailLayout(
        `<p style="margin:0 0 8px">Your confirmation code:</p>
<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;font-family:Menlo,Consolas,monospace">${code}</p>`,
        "If you didn't request this, ignore this email."
      ),
      text: `Your ${SITE_NAME} confirmation code: ${data.token}`,
    });
    return;
  }

  if (!SIGN_IN_ACTIONS.has(data.email_action_type)) {
    // The app has no password reset or email change, so these can't be
    // triggered from it.
    throw new UnsupportedAuthEmailError(`Unsupported auth email: ${data.email_action_type}`);
  }

  // Supabase's verify endpoint checks the token and redirects to
  // redirect_to (our /auth/callback) with a code to exchange.
  const link = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`);
  link.searchParams.set("token", data.token_hash);
  link.searchParams.set("type", data.email_action_type === "email" ? "magiclink" : data.email_action_type);
  if (data.redirect_to) link.searchParams.set("redirect_to", data.redirect_to);
  const href = escapeHtml(link.toString());

  await sendEmail({
    to,
    subject: `Your ${SITE_NAME} sign-in code: ${data.token}`,
    html: emailLayout(
      `<p style="margin:0 0 8px">Your sign-in code:</p>
<p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:6px;font-family:Menlo,Consolas,monospace">${code}</p>
<p style="margin:0 0 12px">Or sign in on this device:</p>
<p style="margin:0 0 16px"><a href="${href}" style="display:inline-block;background:#6426ef;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Sign in</a></p>`,
      "The code expires in 1 hour. If you didn't try to sign in, ignore this email."
    ),
    text: `Your ${SITE_NAME} sign-in code: ${data.token}\n\nOr sign in on this device: ${link.toString()}\n\nThe code expires in 1 hour. If you didn't try to sign in, ignore this email.`,
  });
}
