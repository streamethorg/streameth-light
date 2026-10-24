import Link from "next/link";
import { redirect } from "next/navigation";
import PageHero from "@/components/PageHero";
import { EmbedForm, MyEmbedList, type EventOption, type MyEmbed } from "@/components/EmbedForm";
import { createClient } from "@/lib/supabase/server";
import { emailCanReport, listReportersForUser, NOT_A_REPORTER, storiesConfigured } from "@/lib/stories";
import { listEmbedsForUser } from "@/lib/embeds";
import { mediaLabel } from "@/lib/embedCore.mjs";
import { formatEventDates, getSeasonEvent, listCoverageEvents } from "@/lib/season";

export const metadata = {
  title: "Add to an event's feed — StreamETH",
  robots: { index: false },
};

const PANEL = "flex flex-col gap-4 rounded-sm bg-panel p-5 ring-1 ring-line";

/** Where reporters add media to an event's feed by link: a YouTube video,
 * an X post, a Spotify episode, any page. ?event=<event key> preselects the
 * event (from the event page's "Add to feed" button). */
export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const eventKey = typeof query.event === "string" ? query.event : undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(eventKey ? `/add?event=${eventKey}` : "/add")}`);
  }

  const configured = storiesConfigured();
  const allowed = configured && emailCanReport(user.email);
  const reporters = configured ? (await listReportersForUser(user.id)).filter((r) => r.trust !== "suspended") : [];
  const mine = configured ? await listEmbedsForUser(user.id) : [];

  const events: EventOption[] = listCoverageEvents().map((e) => ({
    key: e.key,
    label: `${e.name} · ${formatEventDates(e)}`,
  }));
  const myEmbeds: MyEmbed[] = mine.map((e) => {
    const event = getSeasonEvent(e.eventKey);
    return {
      id: e.id,
      title: e.title,
      label: mediaLabel(e.provider, e.variant),
      url: e.url,
      eventName: event?.name ?? "Unknown event",
      eventHref: event?.href ?? null,
      reporterName: e.reporter.name,
    };
  });

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Add to an event's feed"
        meta="Share a YouTube video, an X post, a podcast episode or any page with an event's readers, under your reporter's byline."
      />
      <div className="flex max-w-2xl flex-col gap-4 px-4 py-6 sm:px-8">
        {!configured ? (
          <p className="text-sm text-ink-dim">Reporting isn&apos;t set up on this server.</p>
        ) : !allowed ? (
          <section className={PANEL}>
            <p className="text-sm text-ink-dim">{NOT_A_REPORTER}</p>
          </section>
        ) : reporters.length === 0 ? (
          <section className={PANEL}>
            <p className="text-sm text-ink-dim">Media is added under a reporter byline. Create one first.</p>
            <Link
              href="/connect#reporters"
              className="w-fit rounded-sm border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:border-ink-faint"
            >
              Create a reporter
            </Link>
          </section>
        ) : (
          <section className={PANEL}>
            <p className="text-sm text-ink-dim">
              YouTube, X, Vimeo, TikTok, Spotify and SoundCloud links play in the feed; any other page shows as a link card.
              Nothing is copied — if the original is deleted, it stops playing here too.
            </p>
            <EmbedForm
              reporters={reporters.map((r) => ({ slug: r.slug, name: r.name }))}
              events={events}
              initialEventKey={eventKey}
            />
          </section>
        )}

        {configured && (mine.length > 0 || allowed) && (
          <section className={PANEL}>
            <h2 className="text-base font-bold text-ink">Your media</h2>
            <MyEmbedList embeds={myEmbeds} />
          </section>
        )}
      </div>
    </div>
  );
}
