import CarouselTrack from "@/components/CarouselTrack";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import type { UnifiedVideo } from "@/lib/videoDb";

export default function SessionCarousel({
  title,
  videos,
}: {
  title: string;
  videos: UnifiedVideo[];
}) {
  if (videos.length === 0) return null;

  return (
    <CarouselTrack title={title}>
      {videos.map((v) => (
        <div key={v.id} className="w-56 shrink-0 snap-start sm:w-64">
          <UnifiedVideoCard video={v} />
        </div>
      ))}
    </CarouselTrack>
  );
}
