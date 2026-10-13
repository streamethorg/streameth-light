-- Shrinks transcript_chunks.embedding from vector(1536) to halfvec(512).
--
-- At ~300k chunks the full-size vectors made the table 2.8GB, far beyond
-- what the project's Postgres instance can hold in memory: the HNSW index
-- couldn't be built (it was dropped for the bulk load and never came back),
-- so every match_transcript_chunks call fell back to a sequential scan and
-- hit the 2-minute statement timeout.
--
-- text-embedding-3-small is trained so that a prefix of its output,
-- re-normalized, is itself a valid lower-dimension embedding (the same thing
-- its `dimensions` API parameter does), so the existing vectors are cut down
-- in place — no re-embedding. halfvec halves the storage again. ~1KB per row
-- instead of ~6KB.
--
-- The index is IVFFlat, not HNSW: even at 512 dims an HNSW build on this
-- instance (~1GB RAM, one shared vCPU) ran out of maintenance memory a third
-- of the way in and slowed to ~20 rows/s on disk — hours for 330k rows.
-- IVFFlat builds in minutes here. lists ≈ sqrt(rows); probes is set on the
-- search function below to trade a little recall for speed.
--
-- Copies into a new table rather than ALTER COLUMN TYPE so the old table's
-- space is released by a plain DROP instead of needing a VACUUM FULL. On the
-- live project the INSERT ... SELECT below was run in id-range batches to
-- stay under the statement timeout; on a fresh database the table is empty.
-- Clients (scripts/embed-transcripts.mjs, lib/transcriptChunks.ts) apply the
-- same truncate-and-normalize to new embeddings — see toStoredEmbedding().

create table public.transcript_chunks_new (
  id bigint generated always as identity primary key,
  video_id text not null check (char_length(video_id) between 1 and 64),
  source text not null check (source in ('streameth', 'youtube')),
  chunk_index int not null check (chunk_index >= 0),
  content text not null,
  embedding halfvec(512) not null,
  created_at timestamptz not null default now(),
  unique (video_id, chunk_index)
);

insert into public.transcript_chunks_new (video_id, source, chunk_index, content, embedding, created_at)
select video_id, source, chunk_index, content,
       l2_normalize(subvector(embedding, 1, 512))::halfvec(512),
       created_at
from public.transcript_chunks;

drop function if exists public.match_transcript_chunks(vector, int);
drop table public.transcript_chunks;
alter table public.transcript_chunks_new rename to transcript_chunks;
alter table public.transcript_chunks rename constraint transcript_chunks_new_pkey to transcript_chunks_pkey;
alter table public.transcript_chunks rename constraint transcript_chunks_new_video_id_chunk_index_key to transcript_chunks_video_id_chunk_index_key;

create index if not exists transcript_chunks_video_idx on public.transcript_chunks (video_id);
create index if not exists transcript_chunks_embedding_idx
  on public.transcript_chunks using ivfflat (embedding halfvec_cosine_ops) with (lists = 600);

alter table public.transcript_chunks enable row level security;

-- plpgsql so ivfflat.probes can be set per call with set_config(): a
-- `set ivfflat.probes = ...` clause on the function is refused for the
-- migration role ("permission denied to set parameter"). probes = 20 of the
-- 600 lists keeps recall high at ~3% of the table scanned.
create or replace function public.match_transcript_chunks(
  query_embedding halfvec(512),
  match_count int default 20
)
returns table (
  video_id text,
  source text,
  chunk_index int,
  content text,
  similarity float
)
language plpgsql stable
as $$
begin
  perform set_config('ivfflat.probes', '20', true);
  return query
    select c.video_id, c.source, c.chunk_index, c.content,
           (1 - (c.embedding <=> query_embedding))::float as similarity
    from public.transcript_chunks c
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;

revoke all on function public.match_transcript_chunks(halfvec, int) from public, anon, authenticated;
grant execute on function public.match_transcript_chunks(halfvec, int) to service_role;
