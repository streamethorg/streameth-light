import PageHero from "@/components/PageHero";
import SpeakerBrowser from "@/components/SpeakerBrowser";
import { listSpeakers } from "@/lib/people";
import { buildMetadata } from "@/lib/social";

export const metadata = buildMetadata({
  title: "Speakers — StreamETH",
  description: "Every speaker with a public session in the archive.",
  path: "/speakers",
});

export default function SpeakersPage() {
  const speakers = listSpeakers();

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Speakers"
        meta={`${speakers.length.toLocaleString()} people who've spoken on a recorded stage`}
      />
      <div className="flex flex-1 flex-col px-4 py-6 sm:px-8">
        {/* Only what a card shows — bios and session lists would add
            ~400KB to the page for nothing. */}
        <SpeakerBrowser
          speakers={speakers.map((sp) => ({
            name: sp.name,
            slug: sp.slug,
            company: sp.company,
            photo: sp.photo,
            talks: sp.sessionIds.length,
          }))}
        />
      </div>
    </div>
  );
}
