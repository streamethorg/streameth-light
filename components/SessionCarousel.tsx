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
    <div className="flex w-full flex-col gap-3">
      <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">{title}</h2>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {videos.map((v) => (
          <div key={v.id} className="w-56 shrink-0 sm:w-64">
            <UnifiedVideoCard video={v} />
          </div>
        ))}
      </div>
    </div>
  );
}
