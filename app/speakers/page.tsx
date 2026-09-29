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
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          Speakers
        </h1>
        <p className="font-mono text-xs tabular text-ink-faint">
          {speakers.length} speakers across the archive
        </p>
      </div>
      <SpeakerBrowser speakers={speakers} />
    </div>
  );
}
