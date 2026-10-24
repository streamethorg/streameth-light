-- Semantic search within a set of talks — "Ask about this event" searches
-- only that event's recordings. An exact scan over the given videos' chunks
-- (found through transcript_chunks_video_idx), not the IVFFlat index: an
-- event has at most a few hundred talks (a few thousand chunks), and an
-- approximate index search filtered afterwards would return too few rows.
create or replace function public.match_transcript_chunks_in(
  query_embedding halfvec(512),
  video_ids text[],
  match_count int default 20
)
returns table (
  video_id text,
  source text,
  chunk_index int,
  content text,
  similarity float
)
language sql stable
as $$
  with scoped as materialized (
    select c.video_id, c.source, c.chunk_index, c.content, c.embedding
    from public.transcript_chunks c
    where c.video_id = any(video_ids)
  )
  select s.video_id, s.source, s.chunk_index, s.content,
         (1 - (s.embedding <=> query_embedding))::float as similarity
  from scoped s
  order by s.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_transcript_chunks_in(halfvec, text[], int) from public, anon, authenticated;
grant execute on function public.match_transcript_chunks_in(halfvec, text[], int) to service_role;
