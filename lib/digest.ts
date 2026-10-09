import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lazy } from "./lazy";
import { newTalksSince, type NewTalksGroup } from "./events";
import { SITE_NAME, SITE_URL } from "./social";
import { absolute, emailLayout, escapeHtml, sendEmail, sendEmailBatch } from "./email";

/** Weekly "new talks" email: subscribers (double opt-in) in Supabase's
 * digest_subscribers table, mail sent through Resend's HTTP API. Needs
 * SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY and DIGEST_FROM. */

const DAY = 24 * 60 * 60 * 1000;
const RESEND_BATCH_SIZE = 100;
// Don't resend a confirmation to the same address more often than this.
const CONFIRM_RESEND_MS = 10 * 60 * 1000;
const TALKS_PER_EVENT = 5;
const MAX_EVENTS = 12;

export function digestConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.RESEND_API_KEY &&
      process.env.DIGEST_FROM
  );
}

const getAdmin = lazy(
  (): SupabaseClient =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

// ── Subscribing ─────────────────────────────────────────────────────────

/** Records a subscription request and emails the confirmation link. Always
 * resolves the same way for a valid address, so the form doesn't reveal
 * who is subscribed. */
export async function requestSubscription(email: string): Promise<void> {
  const db = getAdmin();
  const { data: existing, error } = await db
    .from("digest_subscribers")
    .select("token, confirmed_at, unsubscribed_at, confirm_sent_at")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;

  if (existing?.confirmed_at && !existing.unsubscribed_at) return;
  if (existing?.confirm_sent_at && Date.now() - new Date(existing.confirm_sent_at).getTime() < CONFIRM_RESEND_MS) {
    return;
  }

  let token: string = existing?.token;
  if (!existing) {
    const { data, error: insertError } = await db
      .from("digest_subscribers")
      .insert({ email })
      .select("token")
      .single();
    if (insertError) throw insertError;
    token = data.token;
  }

  const link = absolute(`/digest/confirm?token=${token}`);
  await sendEmail({
    to: email,
    subject: `Confirm your ${SITE_NAME} weekly digest`,
    html: emailLayout(
      `<p style="margin:0 0 16px">Confirm you'd like a weekly email of new talks from Ethereum conferences and meetups.</p>
<p style="margin:0 0 16px"><a href="${link}" style="display:inline-block;background:#6426ef;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Confirm subscription</a></p>
<p style="margin:0;color:#55516b;font-size:13px">If you didn't ask for this, ignore this email and nothing will be sent.</p>`,
      `You're receiving this because someone entered this address at ${SITE_URL.replace(/^https?:\/\//, "")}.`
    ),
    text: `Confirm you'd like a weekly email of new talks from Ethereum conferences and meetups:\n\n${link}\n\nIf you didn't ask for this, ignore this email.`,
  });

  const { error: updateError } = await db
    .from("digest_subscribers")
    .update({ confirm_sent_at: new Date().toISOString() })
    .eq("email", email);
  if (updateError) throw updateError;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Confirms a subscription by its link token; false if the token is unknown. */
export async function confirmSubscription(token: string): Promise<boolean> {
  if (!UUID_RE.test(token)) return false;
  const { data, error } = await getAdmin()
    .from("digest_subscribers")
    .update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null })
    .eq("token", token)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Unsubscribes by link token; false if the token is unknown. */
export async function unsubscribe(token: string): Promise<boolean> {
  if (!UUID_RE.test(token)) return false;
  const { data, error } = await getAdmin()
    .from("digest_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("token", token)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// ── The weekly send ─────────────────────────────────────────────────────

function digestEmail(groups: NewTalksGroup[], token: string) {
  const total = groups.reduce((n, g) => n + g.videos.length, 0);
  const shown = groups.slice(0, MAX_EVENTS);
  const unsubscribeUrl = absolute(`/digest/unsubscribe?token=${token}`);
  const subject = `${total} new ${total === 1 ? "talk" : "talks"} this week on ${SITE_NAME}`;

  const htmlGroups = shown
    .map((g) => {
      const items = g.videos
        .slice(0, TALKS_PER_EVENT)
        .map(
          (v) => `<tr><td style="padding:6px 0">
<a href="${absolute(v.watchUrl)}" style="color:#140f2e;font-weight:600;text-decoration:none">${escapeHtml(v.title)}</a>
${v.speakers.length ? `<div style="font-size:13px;color:#6426ef">${escapeHtml(v.speakers.join(", "))}</div>` : ""}
</td></tr>`
        )
        .join("");
      const more = g.videos.length - TALKS_PER_EVENT;
      return `<div style="padding:16px 0;border-top:1px solid #e6e4ee">
<a href="${absolute(g.href)}" style="font-size:16px;font-weight:700;color:#140f2e;text-decoration:none">${escapeHtml(g.name)}</a>
<span style="font-size:13px;color:#827e97"> · ${g.videos.length} new</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">${items}</table>
${more > 0 ? `<a href="${absolute(g.href)}" style="font-size:13px;color:#6426ef;text-decoration:none">+${more} more →</a>` : ""}
</div>`;
    })
    .join("");
  const otherEvents = groups.length - shown.length;

  const html = emailLayout(
    `<p style="margin:0 0 8px;font-size:20px;font-weight:700">${total} new ${total === 1 ? "talk" : "talks"} this week</p>
<p style="margin:0 0 8px;color:#55516b">From ${groups.length} ${groups.length === 1 ? "event" : "events"}. Got a question? <a href="${absolute("/")}" style="color:#6426ef">Ask the archive</a>.</p>
${htmlGroups}
${otherEvents > 0 ? `<p style="margin:16px 0 0"><a href="${absolute("/events")}" style="color:#6426ef">And ${otherEvents} more ${otherEvents === 1 ? "event" : "events"} →</a></p>` : ""}`,
    `You subscribed to the ${SITE_NAME} weekly digest. <a href="${unsubscribeUrl}" style="color:#827e97">Unsubscribe</a>.`
  );

  const text = [
    `${total} new ${total === 1 ? "talk" : "talks"} this week on ${SITE_NAME}`,
    "",
    ...shown.flatMap((g) => [
      `${g.name} (${g.videos.length} new) — ${absolute(g.href)}`,
      ...g.videos
        .slice(0, TALKS_PER_EVENT)
        .map((v) => `- ${v.title}${v.speakers.length ? ` — ${v.speakers.join(", ")}` : ""}\n  ${absolute(v.watchUrl)}`),
      "",
    ]),
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  return {
    subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${absolute(`/api/digest/unsubscribe?token=${token}`)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** Sends this week's digest to every confirmed subscriber who hasn't had
 * one in the past six days (so a retried or doubled cron run doesn't send
 * twice). Skips entirely when nothing new was published. */
export async function sendWeeklyDigest(now = Date.now()): Promise<{ talks: number; sent: number; failed: number }> {
  const groups = newTalksSince(now - 7 * DAY);
  const talks = groups.reduce((n, g) => n + g.videos.length, 0);
  if (talks === 0) return { talks, sent: 0, failed: 0 };

  const db = getAdmin();
  const cutoff = new Date(now - 6 * DAY).toISOString();
  let sent = 0;
  let failed = 0;

  // Page through recipients; each sent batch drops out of the query via
  // last_sent_at, so always read the first page.
  for (;;) {
    const { data: recipients, error } = await db
      .from("digest_subscribers")
      .select("id, email, token")
      .not("confirmed_at", "is", null)
      .is("unsubscribed_at", null)
      .or(`last_sent_at.is.null,last_sent_at.lt.${cutoff}`)
      .order("id")
      .limit(RESEND_BATCH_SIZE);
    if (error) throw error;
    if (!recipients || recipients.length === 0) break;

    const ids = recipients.map((r) => r.id as string);
    try {
      await sendEmailBatch(recipients.map((r) => ({ to: r.email as string, ...digestEmail(groups, r.token as string) })));
      sent += recipients.length;
    } catch (err) {
      console.error("[digest] batch failed:", err);
      failed += recipients.length;
    }
    // Mark the batch either way: a failed batch is retried by next week's
    // run rather than looping on it now.
    const { error: markError } = await db
      .from("digest_subscribers")
      .update({ last_sent_at: new Date(now).toISOString() })
      .in("id", ids);
    if (markError) throw markError;
  }

  return { talks, sent, failed };
}
