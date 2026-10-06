import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHero from "@/components/PageHero";
import VideoTile from "@/components/VideoTile";
import { formatDateShort } from "@/lib/format";

export const metadata = {
  title: "Saved — StreamETH",
};

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?next=/saved");
  }

  const { data: saved } = await supabase
    .from("saved_videos")
    .select("video_id, video_source, video_title, video_cover_image, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Saved"
        meta={
          saved && saved.length > 0
            ? `${saved.length} ${saved.length === 1 ? "talk" : "talks"} to watch later`
            : "Talks you save show up here"
        }
      />

      <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
        {!saved || saved.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-panel px-6 py-14 text-center ring-1 ring-line">
            <p className="text-lg font-bold tracking-[-0.01em] text-ink">Nothing saved yet</p>
            <p className="max-w-sm text-sm text-ink-dim">
              Press Save under any talk and it will be waiting here.
            </p>
            <Link
              href="/"
              className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              Find something to watch
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {saved.map((v) => (
              <VideoTile
                key={v.video_id}
                href={`/watch/${v.video_id}`}
                coverImage={v.video_cover_image}
                coverLabel={v.video_title}
                title={v.video_title}
                date={`Saved ${formatDateShort(v.created_at)}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
