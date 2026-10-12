-- Talk transcripts, chunked and embedded for semantic search. Replaces
-- transcript text embedded in data/streameth.db (SQLite), which stopped
-- scaling once the YouTube backfill reached ~270MB of transcript text —
-- past Vercel's 250MB serverless function size limit. Chunks live here
-- instead and are fetched over the network at request time (search.ts's
-- match_transcript_chunks RPC, lib/transcriptChunks.ts's plain selects).
--
-- Only the server touches this table, with the service-role key: RLS is on
-- with no policies, so the public anon key can't read or write it.
create extension if not exists vector;

create table if not exists public.transcript_chunks (
  id bigint generated always as identity primary key,
  video_id text not null check (char_length(video_id) between 1 and 64),
  source text not null check (source in ('streameth', 'youtube')),
  chunk_index int not null check (chunk_index >= 0),
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (video_id, chunk_index)
);

create index if not exists transcript_chunks_video_idx on public.transcript_chunks (video_id);
create index if not exists transcript_chunks_embedding_idx
  on public.transcript_chunks using hnsw (embedding vector_cosine_ops);

alter table public.transcript_chunks enable row level security;

-- Cosine-similarity search over all chunks. security_invoker isn't set
-- (default security_invoker=false definer-ish behavior for functions is
-- just "runs as owner"), but since nothing is granted to anon/authenticated
-- below, this is unreachable except via the service-role key anyway.
create or replace function public.match_transcript_chunks(
  query_embedding vector(1536),
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
  select video_id, source, chunk_index, content,
         1 - (embedding <=> query_embedding) as similarity
  from public.transcript_chunks
  order by embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_transcript_chunks(vector, int) from public, anon, authenticated;
grant execute on function public.match_transcript_chunks(vector, int) to service_role;
