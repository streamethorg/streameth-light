import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import SpeakerBrowser from "@/components/SpeakerBrowser";
import { listSpeakers } from "@/lib/people";

export const metadata: Metadata = {
  title: "Speakers — StreamETH",
  description: "Every speaker with a public session in the archive.",
};

export default function SpeakersPage() {
  const speakers = listSpeakers();

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Speakers"
        meta={`${speakers.length.toLocaleString()} people who've spoken on a recorded stage`}
      />
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-10 sm:px-6 sm:py-12">
        <SpeakerBrowser speakers={speakers} />
      </div>
    </div>
  );
}
