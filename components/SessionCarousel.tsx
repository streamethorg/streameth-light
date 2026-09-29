import type { ComponentProps } from "react";
import CarouselTrack from "@/components/CarouselTrack";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import type { UnifiedVideo } from "@/lib/videoDb";

export default function SessionCarousel({
  videos,
  ...header
}: Omit<ComponentProps<typeof CarouselTrack>, "children"> & {
  videos: UnifiedVideo[];
}) {
  if (videos.length === 0) return null;

  return (
    <CarouselTrack {...header}>
      {videos.map((v) => (
        <div key={v.id} className="w-64 shrink-0 snap-start sm:w-72">
          <UnifiedVideoCard video={v} />
        </div>
      ))}
    </CarouselTrack>
  );
}
