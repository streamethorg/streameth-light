import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CoverPlaceholder from "@/components/CoverPlaceholder";
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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Saved</h1>
        <p className="text-sm text-ink-dim">Videos you&apos;ve bookmarked to watch later.</p>
      </header>

      {!saved || saved.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-faint">
          Nothing saved yet — hit Save on any video to add it here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {saved.map((v) => (
            <Link key={v.video_id} href={`/watch/${v.video_id}`} className="group flex flex-col gap-2.5">
              <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-panel">
                {v.video_cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.video_cover_image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <CoverPlaceholder label={v.video_title} />
                )}
              </div>
              <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
                {v.video_title}
              </h3>
              <p className="font-mono text-[11px] text-ink-faint">
                Saved {formatDateShort(v.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
