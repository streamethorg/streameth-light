import Link from "next/link";
import CoverImage from "./CoverImage";
import type { UnifiedVideo } from "@/lib/videoDb";
import { videoLink } from "@/lib/videoLink";

/** A YouTube Short: a tall 9:16 cover with the title over its foot. */
export default function ShortCard({ video }: { video: UnifiedVideo }) {
  return (
    <Link
      href={videoLink(video)}
      className="group relative block aspect-[9/16] overflow-hidden rounded-sm bg-panel-raised"
      title={video.title}
    >
      <CoverImage src={video.coverImage} label={video.title} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2.5 pb-2.5 pt-10">
        <p className="line-clamp-3 text-[14px] font-semibold leading-[1.15rem] text-white">
          {video.title}
        </p>
      </div>
    </Link>
  );
}

/** A row of Shorts that swipes sideways on phones and wraps into a grid on
 * wider screens. */
export function ShortsRow({ videos, max = 6 }: { videos: UnifiedVideo[]; max?: number }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
      {videos.slice(0, max).map((v) => (
        <div key={v.id} className="w-[42%] shrink-0 snap-start sm:w-auto">
          <ShortCard video={v} />
        </div>
      ))}
    </div>
  );
}
