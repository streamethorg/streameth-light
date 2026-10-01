import PageHero from "@/components/PageHero";
import SpeakerBrowser from "@/components/SpeakerBrowser";
import { listSpeakers } from "@/lib/people";
import { buildMetadata } from "@/lib/social";

export const metadata = buildMetadata({
  title: "Speakers — StreamETH",
  description: "Every speaker with a public session in the archive.",
});

export default function SpeakersPage() {
  const speakers = listSpeakers();

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Speakers"
        meta={`${speakers.length.toLocaleString()} people who've spoken on a recorded stage`}
      />
      <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
        <SpeakerBrowser speakers={speakers} />
      </div>
    </div>
  );
}
