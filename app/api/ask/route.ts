import { answerQuestion, askConfigured, AskBusyError, MAX_QUESTION_CHARS, type AskEvent } from "@/lib/ask";
import { consumeAskQuota } from "@/lib/askQuota";
import { createClient } from "@/lib/supabase/server";
import { eventCoverage, getSeasonEvent, requestTime } from "@/lib/season";
import { eventBrief } from "@/lib/eventBrief";

// Most talks an event-scoped question searches across.
const MAX_EVENT_VIDEOS = 1000;

// Answers can take a few searches plus generation.
export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** Streams an AI answer as newline-delimited JSON AskEvents. Signed-in
 * users only: 401 tells the UI to show its sign-in prompt. */
export async function POST(request: Request) {
  if (!askConfigured()) return jsonError("Ask isn't set up on this deployment.", 503);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in to ask.", 401);

  let question = "";
  let videoId: string | undefined;
  let eventKey: string | undefined;
  try {
    const body = (await request.json()) as { question?: unknown; videoId?: unknown; eventKey?: unknown };
    question = typeof body.question === "string" ? body.question.trim() : "";
    // Optional: scope the question to one talk (the watch page's panel)…
    if (typeof body.videoId === "string" && /^[\w-]{1,64}$/.test(body.videoId)) videoId = body.videoId;
    // …or to one event (the event page's panel): calendar events
    // ("mira:…") and archive events ("streameth:…", "youtube:<channel>:<group>").
    if (
      typeof body.eventKey === "string" &&
      /^(mira:[A-Za-z0-9]{1,40}|streameth:[A-Za-z0-9]{1,40}|youtube:[a-z0-9_-]{1,80}:[a-z0-9-]{1,160})$/.test(body.eventKey)
    ) {
      eventKey = body.eventKey;
    }
  } catch {
    return jsonError("Send JSON: {\"question\": \"…\"}", 400);
  }
  if (question.length < 3) return jsonError("Ask a question.", 400);
  const seasonEvent = eventKey ? getSeasonEvent(eventKey) : undefined;
  if (eventKey && !seasonEvent) return jsonError("No such event.", 404);
  if (question.length > MAX_QUESTION_CHARS) {
    return jsonError(`Keep questions under ${MAX_QUESTION_CHARS} characters.`, 400);
  }
  const eventScope = seasonEvent
    ? {
        name: seasonEvent.name,
        videoIds: eventCoverage(seasonEvent, MAX_EVENT_VIDEOS)
          .filter((v) => v.hasTranscript)
          .map((v) => v.id),
        brief: await eventBrief(seasonEvent, requestTime()),
      }
    : undefined;

  const quota = await consumeAskQuota(user.id);
  if (quota === "limited") {
    return jsonError("You've asked a lot of questions — try again in an hour.", 429);
  }
  if (quota === "unavailable") return jsonError("Ask is temporarily unavailable.", 503);

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of answerQuestion(question, request.signal, videoId, eventScope)) send(event);
      } catch (err) {
        if (!request.signal.aborted) {
          console.error("[ask] answer failed:", err);
          send({
            type: "error",
            message:
              err instanceof AskBusyError
                ? "Ask is busy right now. Try again in a couple of minutes."
                : "Something went wrong answering that. Try again.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
