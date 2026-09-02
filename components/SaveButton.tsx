"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SaveButton({
  videoId,
  videoSource,
  title,
  coverImage,
}: {
  videoId: string;
  videoSource: "streameth" | "youtube";
  title: string;
  coverImage: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncedUserId, setSyncedUserId] = useState(userId);

  if (userId !== syncedUserId) {
    setSyncedUserId(userId);
    if (!userId) setSaved(false);
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase
      .from("saved_videos")
      .select("video_id")
      .eq("user_id", userId)
      .eq("video_id", videoId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setSaved(Boolean(data));
      });
    return () => {
      active = false;
    };
  }, [supabase, userId, videoId]);

  async function toggle() {
    if (userId === undefined || busy) return;
    if (!userId) {
      router.push(`/signin?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    if (saved) {
      await supabase.from("saved_videos").delete().eq("user_id", userId).eq("video_id", videoId);
      setSaved(false);
    } else {
      await supabase.from("saved_videos").insert({
        user_id: userId,
        video_id: videoId,
        video_source: videoSource,
        video_title: title,
        video_cover_image: coverImage,
      });
      setSaved(true);
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={userId === undefined || busy}
      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-60 ${
        saved
          ? "border-accent bg-accent/10 text-accent"
          : "border-line text-ink-dim hover:bg-panel hover:text-ink"
      }`}
    >
      {saved ? "Saved" : "Save"}
    </button>
  );
}
