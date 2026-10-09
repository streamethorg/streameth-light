import "server-only";
import { SITE_NAME, SITE_URL } from "./social";

/** Mail sent through Resend's HTTP API, from DIGEST_FROM: the weekly digest
 * (lib/digest.ts) and the sign-in codes (lib/authEmail.ts). Needs
 * RESEND_API_KEY and DIGEST_FROM. */

const RESEND_URL = "https://api.resend.com";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.DIGEST_FROM);
}

export function absolute(path: string): string {
  return new URL(path, SITE_URL).toString();
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

function resendPayload(email: OutgoingEmail) {
  return {
    from: process.env.DIGEST_FROM!,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    headers: email.headers,
  };
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const res = await fetch(`${RESEND_URL}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(resendPayload(email)),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export async function sendEmailBatch(emails: OutgoingEmail[]): Promise<void> {
  const res = await fetch(`${RESEND_URL}/emails/batch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(emails.map(resendPayload)),
  });
  if (!res.ok) throw new Error(`Resend batch ${res.status}: ${await res.text()}`);
}

export function emailLayout(body: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f2f1f6;font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#140f2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px">
<tr><td style="padding:24px 28px 8px"><a href="${absolute("/")}" style="font-size:18px;font-weight:700;color:#140f2e;text-decoration:none">${SITE_NAME}</a></td></tr>
<tr><td style="padding:8px 28px 24px;font-size:15px;line-height:1.5">${body}</td></tr>
</table>
<p style="max-width:600px;font-size:12px;line-height:1.5;color:#827e97;margin:16px auto 0">${footer}</p>
</td></tr></table></body></html>`;
}
