-- Saved videos: lets a signed-in user bookmark a video (StreamETH session
-- or YouTube upload) from the unified catalog in data/streameth.db. video_id
-- matches videos.id there ("<mongo-id>" for StreamETH, "yt-<videoId>" for
-- YouTube) — no foreign key, since that catalog lives in a separate,
-- regenerated SQLite file, not this Postgres database.
create table if not exists public.saved_videos (
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null,
  video_source text not null check (video_source in ('streameth', 'youtube')),
  video_title text not null,
  video_cover_image text,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table public.saved_videos enable row level security;

create policy "Users can view their own saved videos"
  on public.saved_videos for select
  using (auth.uid() = user_id);

create policy "Users can save videos for themselves"
  on public.saved_videos for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own saved videos"
  on public.saved_videos for delete
  using (auth.uid() = user_id);
