-- Persist verified transcript timing and provenance returned by STT providers.
alter table public.keeper_media_transcripts
  add column if not exists segments jsonb not null default '[]'::jsonb,
  add column if not exists duration_seconds numeric,
  add column if not exists confidence numeric,
  add column if not exists extraction_method text;

alter table public.keeper_media drop constraint if exists keeper_media_processing_status_check;
alter table public.keeper_media add constraint keeper_media_processing_status_check check (processing_status in (
  'QUEUED','PENDING','EXTRACTING','MEDIA_FOUND','EXTRACTING_AUDIO','TRANSCRIBING','TRANSCRIPT_READY',
  'ANALYZING','GENERATING_TAGS','MATCHING_COLLECTION','ORGANIZING','INDEXING','COMPLETED','FAILED',
  'EXTRACTION_FAILED','TRANSCRIPTION_FAILED','ANALYSIS_FAILED','ORGANIZATION_FAILED','INDEXING_FAILED'
));
alter table public.keeper_ai_jobs drop constraint if exists keeper_ai_jobs_status_check;
alter table public.keeper_ai_jobs add constraint keeper_ai_jobs_status_check check (status in (
  'QUEUED','PENDING','EXTRACTING','MEDIA_FOUND','EXTRACTING_AUDIO','TRANSCRIBING','TRANSCRIPT_READY',
  'ANALYZING','GENERATING_TAGS','MATCHING_COLLECTION','ORGANIZING','INDEXING','COMPLETED','FAILED',
  'EXTRACTION_FAILED','TRANSCRIPTION_FAILED','ANALYSIS_FAILED','ORGANIZATION_FAILED','INDEXING_FAILED'
));
