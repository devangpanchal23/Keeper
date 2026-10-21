-- Preserve normalized retry diagnostics and recover every nonterminal worker stage.
alter table public.keeper_ai_jobs add column if not exists failure_code text;

create or replace function public.keeper_claim_ai_job()
returns setof public.keeper_ai_jobs
language plpgsql security definer set search_path = public as $$
begin
  -- A worker that crashes five times is moved to the terminal failure state.
  with exhausted as (
    update public.keeper_ai_jobs
       set status = 'FAILED', locked_until = null,
           last_error = coalesce(last_error, 'Worker lease expired after the retry limit.'),
           failure_code = coalesce(failure_code, 'RETRY_EXHAUSTED'), updated_at = now()
     where status in ('QUEUED','PENDING','EXTRACTING','MEDIA_FOUND','EXTRACTING_AUDIO','TRANSCRIBING','TRANSCRIPT_READY',
                      'ANALYZING','GENERATING_TAGS','MATCHING_COLLECTION','ORGANIZING','INDEXING')
       and attempts >= 5 and (locked_until is null or locked_until < now())
    returning workspace_id, media_id
  )
  update public.keeper_media m set processing_status = 'FAILED', updated_at = now()
    from exhausted e where m.id = e.media_id and m.workspace_id = e.workspace_id;

  return query
  with candidate as (
    select id from public.keeper_ai_jobs
     where status in ('QUEUED','PENDING','EXTRACTING','MEDIA_FOUND','EXTRACTING_AUDIO','TRANSCRIBING','TRANSCRIPT_READY',
                      'ANALYZING','GENERATING_TAGS','MATCHING_COLLECTION','ORGANIZING','INDEXING')
       and attempts < 5 and available_at <= now()
       and (locked_until is null or locked_until < now())
     order by created_at for update skip locked limit 1
  )
  update public.keeper_ai_jobs j
     set status = 'EXTRACTING', attempts = attempts + 1,
         locked_until = now() + interval '5 minutes', updated_at = now()
    from candidate where j.id = candidate.id returning j.*;
end;
$$;
revoke all on function public.keeper_claim_ai_job() from public, anon, authenticated;
grant execute on function public.keeper_claim_ai_job() to service_role;
