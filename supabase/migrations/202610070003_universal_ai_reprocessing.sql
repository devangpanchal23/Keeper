-- Preserve earlier transcripts when users explicitly reprocess an item.
alter table public.keeper_media_transcripts add column if not exists segments jsonb not null default '[]'::jsonb;
alter table public.keeper_media add column if not exists source_platform text;
alter table public.keeper_media add column if not exists source_identifier text;
alter table public.keeper_media add column if not exists content_fingerprint text;

alter table public.keeper_media drop constraint if exists keeper_media_processing_status_check;
alter table public.keeper_media add constraint keeper_media_processing_status_check check (processing_status in (
  'QUEUED','PENDING','EXTRACTING','TRANSCRIBING','ANALYZING','GENERATING_TAGS','MATCHING_COLLECTION','ORGANIZING','INDEXING',
  'COMPLETED','FAILED','EXTRACTION_FAILED','TRANSCRIPTION_FAILED','ANALYSIS_FAILED','ORGANIZATION_FAILED','INDEXING_FAILED'
));
alter table public.keeper_ai_jobs drop constraint if exists keeper_ai_jobs_status_check;
alter table public.keeper_ai_jobs add constraint keeper_ai_jobs_status_check check (status in (
  'QUEUED','PENDING','EXTRACTING','TRANSCRIBING','ANALYZING','GENERATING_TAGS','MATCHING_COLLECTION','ORGANIZING','INDEXING',
  'COMPLETED','FAILED','EXTRACTION_FAILED','TRANSCRIPTION_FAILED','ANALYSIS_FAILED','ORGANIZATION_FAILED','INDEXING_FAILED'
));

create or replace function public.keeper_set_media_identity()
returns trigger language plpgsql set search_path = public as $$
declare
  v_metadata jsonb := coalesce(new.payload->'metadata','{}'::jsonb);
  v_raw jsonb := coalesce(v_metadata->'rawPlatformMetadata','{}'::jsonb);
  v_text text;
begin
  new.source_platform := coalesce(new.payload->>'platform', v_metadata->>'sourcePlatform');
  new.source_identifier := coalesce(v_metadata->>'sourceIdentifier', v_metadata->>'shortcode', v_metadata->>'fbid', v_raw->>'id');
  v_text := lower(trim(concat_ws(' ', new.payload->>'title', new.payload->>'description', v_metadata->>'caption', v_metadata->>'bodyText')));
  if v_text <> '' then new.content_fingerprint := encode(digest(v_text, 'sha256'), 'hex'); end if;
  return new;
end;
$$;
drop trigger if exists keeper_media_identity_before_write on public.keeper_media;
create trigger keeper_media_identity_before_write before insert or update of payload on public.keeper_media
for each row execute function public.keeper_set_media_identity();
update public.keeper_media set payload = payload where source_platform is null or content_fingerprint is null;
with duplicate_source_ids as (
  select id, row_number() over (partition by workspace_id, source_platform, source_identifier order by created_at, id) as ordinal
  from public.keeper_media where source_platform is not null and source_identifier is not null
)
update public.keeper_media media set source_identifier = null
from duplicate_source_ids duplicate
where media.id = duplicate.id and duplicate.ordinal > 1;
create unique index if not exists keeper_media_source_identity_unique
  on public.keeper_media(workspace_id, source_platform, source_identifier)
  where source_identifier is not null and source_platform is not null;
create index if not exists keeper_media_content_fingerprint_idx
  on public.keeper_media(workspace_id, content_fingerprint) where content_fingerprint is not null;

create or replace function public.keeper_import_media(
  p_canonical_url text, p_payload jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_workspace uuid := auth.uid();
  v_media public.keeper_media%rowtype;
  v_sub public.billing_subscriptions%rowtype;
  v_source_platform text := coalesce(p_payload->>'platform', p_payload#>>'{metadata,sourcePlatform}');
  v_source_identifier text := coalesce(p_payload#>>'{metadata,sourceIdentifier}', p_payload#>>'{metadata,shortcode}', p_payload#>>'{metadata,fbid}', p_payload#>>'{metadata,rawPlatformMetadata,id}');
  v_plan text := 'free';
  v_start timestamptz;
  v_end timestamptz;
  v_limit integer := 30;
  v_used integer;
  v_fingerprint_text text;
  v_fingerprint text;
begin
  if v_workspace is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if length(trim(p_canonical_url)) < 8 or p_idempotency_key is null then
    raise exception 'INVALID_IMPORT' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_workspace::text, 0));

  select * into v_media from public.keeper_media
  where workspace_id = v_workspace and canonical_url = p_canonical_url for update;
  if not found and v_source_platform is not null and v_source_identifier is not null then
    select * into v_media from public.keeper_media
    where workspace_id = v_workspace and source_platform = v_source_platform and source_identifier = v_source_identifier for update;
  end if;
  if found then return jsonb_build_object('duplicate', true, 'media_id', v_media.id, 'status', v_media.processing_status); end if;
  v_fingerprint_text := lower(trim(concat_ws(' ', p_payload->>'title', p_payload->>'description', p_payload#>>'{metadata,caption}', p_payload#>>'{metadata,bodyText}')));
  if length(v_fingerprint_text) >= 80 then
    v_fingerprint := encode(digest(v_fingerprint_text, 'sha256'), 'hex');
    select * into v_media from public.keeper_media
      where workspace_id = v_workspace and content_fingerprint = v_fingerprint limit 1 for update;
    if found then return jsonb_build_object('duplicate', true, 'media_id', v_media.id, 'status', v_media.processing_status); end if;
  end if;

  select * into v_sub from public.billing_subscriptions s
  where s.user_id = v_workspace and (s.status in ('trialing','authenticated','active')
    or (s.status in ('cancelled','canceled') and s.cancel_at_cycle_end))
    and coalesce(s.current_period_end, s.trial_ends_at, 'infinity'::timestamptz) > now()
  order by coalesce(s.current_period_end, s.trial_ends_at) desc limit 1;
  if found then
    v_plan := v_sub.plan;
    v_start := coalesce(v_sub.current_period_start, v_sub.created_at);
    v_end := coalesce(v_sub.current_period_end, v_sub.trial_ends_at, v_start + interval '7 days');
    if v_plan = 'basic' then v_limit := case when v_sub.billing_cycle = 'yearly' then 2640 else 220 end;
    else v_limit := -1; end if;
  else
    insert into public.keeper_workspace_memory(workspace_id) values (v_workspace) on conflict do nothing;
    select free_cycle_anchor + floor(extract(epoch from (now() - free_cycle_anchor)) / 604800) * interval '7 days'
    into v_start from public.keeper_workspace_memory where workspace_id = v_workspace;
    v_end := v_start + interval '7 days';
  end if;
  select count(*)::integer into v_used from public.keeper_usage_ledger
  where workspace_id = v_workspace and cycle_start = v_start and cycle_end = v_end;
  if v_limit >= 0 and v_used >= v_limit then raise exception 'CREDIT_LIMIT_REACHED' using errcode = 'P0001'; end if;

  insert into public.keeper_media(workspace_id, canonical_url, payload, processing_status)
  values (v_workspace, p_canonical_url, p_payload, 'QUEUED') on conflict do nothing returning * into v_media;
  if v_media.id is null then
    select * into v_media from public.keeper_media where workspace_id = v_workspace and (
      canonical_url = p_canonical_url or (v_source_platform is not null and source_platform = v_source_platform
        and v_source_identifier is not null and source_identifier = v_source_identifier)
    ) limit 1;
    if v_media.id is not null then return jsonb_build_object('duplicate', true, 'media_id', v_media.id, 'status', v_media.processing_status); end if;
    raise exception 'IMPORT_CONFLICT' using errcode = '40001';
  end if;
  insert into public.keeper_usage_ledger(workspace_id, media_id, event_type, plan, cycle_start, cycle_end)
  values (v_workspace, v_media.id, case when v_plan = 'free' then 'FREE_IMPORT' else 'IMPORT_CREDIT' end, v_plan, v_start, v_end);
  insert into public.keeper_ai_jobs(workspace_id, media_id, idempotency_key, status)
  values (v_workspace, v_media.id, p_idempotency_key, 'QUEUED');
  return jsonb_build_object('duplicate', false, 'media_id', v_media.id, 'status', 'QUEUED', 'plan', v_plan,
    'used', v_used + 1, 'remaining', case when v_limit < 0 then null else v_limit - v_used - 1 end, 'cycle_end', v_end);
end;
$$;
revoke all on function public.keeper_import_media(text,jsonb,text) from public, anon;
grant execute on function public.keeper_import_media(text,jsonb,text) to authenticated;

create or replace function public.keeper_claim_ai_job()
returns setof public.keeper_ai_jobs language plpgsql security definer set search_path = public as $$
begin
  return query with candidate as (
    select id from public.keeper_ai_jobs where status in ('QUEUED','PENDING','EXTRACTING','TRANSCRIBING','ANALYZING','GENERATING_TAGS','MATCHING_COLLECTION','ORGANIZING','INDEXING')
      and available_at <= now() and (locked_until is null or locked_until < now())
    order by created_at for update skip locked limit 1
  ) update public.keeper_ai_jobs j set status = 'EXTRACTING', attempts = attempts + 1,
    locked_until = now() + interval '5 minutes', updated_at = now()
    from candidate where j.id = candidate.id returning j.*;
end;
$$;
revoke all on function public.keeper_claim_ai_job() from public, anon, authenticated;
grant execute on function public.keeper_claim_ai_job() to service_role;

create or replace function public.keeper_update_media_collection(p_media_id uuid, p_collection_id text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_workspace uuid := auth.uid();
  v_payload jsonb;
  v_from_collection text;
  v_tags text[];
  v_topic text;
  v_metadata jsonb;
  v_ai_organization jsonb;
begin
  if v_workspace is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  select payload into v_payload from public.keeper_media
    where id = p_media_id and workspace_id = v_workspace for update;
  if not found then raise exception 'MEDIA_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_collection_id is not null and not exists (
    select 1 from public.keeper_collections where workspace_id = v_workspace and id = p_collection_id
  ) then raise exception 'COLLECTION_NOT_FOUND' using errcode = 'P0002'; end if;
  v_from_collection := v_payload->>'collectionId';
  select coalesce(array_agg(tag), '{}') into v_tags from jsonb_array_elements_text(coalesce(v_payload->'tags','[]'::jsonb)) as item_tags(tag);
  v_topic := v_payload->'topics'->>0;
  v_metadata := coalesce(v_payload->'metadata','{}'::jsonb);
  v_ai_organization := coalesce(v_metadata->'aiOrganization','{}'::jsonb) || jsonb_build_object(
    'aiAssignedCollectionIds','[]'::jsonb,
    'manualCollectionIds',case when p_collection_id is null then '[]'::jsonb else jsonb_build_array(p_collection_id) end,
    'autoOrganizationDisabled',p_collection_id is null
  );
  v_metadata := v_metadata || jsonb_build_object('aiOrganization',v_ai_organization);
  update public.keeper_media set payload = jsonb_set(
      jsonb_set(jsonb_set(v_payload,'{metadata}',v_metadata,true),'{collectionId}',coalesce(to_jsonb(p_collection_id),'null'::jsonb),true),
      '{collections}',case when p_collection_id is null then '[]'::jsonb else jsonb_build_array(p_collection_id) end,true),
    updated_at=now() where id=p_media_id and workspace_id=v_workspace;
  update public.keeper_media_analyses set collection_id=p_collection_id,updated_at=now()
    where media_id=p_media_id and workspace_id=v_workspace;
  insert into public.keeper_organization_corrections(workspace_id,media_id,from_collection_id,to_collection_id,media_tags,media_topic)
    values (v_workspace,p_media_id,v_from_collection,p_collection_id,v_tags,v_topic);
end;
$$;
revoke all on function public.keeper_update_media_collection(uuid,text) from public, anon;
grant execute on function public.keeper_update_media_collection(uuid,text) to authenticated;

create or replace function public.keeper_get_or_create_ai_collection(
  p_workspace_id uuid, p_name text, p_description text, p_terms text[]
) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_collection public.keeper_collections%rowtype;
begin
  if p_workspace_id is null or length(trim(p_name)) < 4 or length(trim(p_name)) > 120 then
    raise exception 'INVALID_AI_COLLECTION' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':' || lower(trim(p_name)), 0));
  select * into v_collection from public.keeper_collections
    where workspace_id = p_workspace_id and lower(name) = lower(trim(p_name)) limit 1 for update;
  if found then return jsonb_build_object('id',v_collection.id,'name',v_collection.name,'description',v_collection.description,'created',false); end if;
  insert into public.keeper_collections(workspace_id,id,name,description,profile,updated_at)
  values (p_workspace_id,gen_random_uuid()::text,trim(p_name),left(coalesce(p_description,''),1000),
    jsonb_build_object('topics',coalesce(p_terms,'{}'::text[]),'tags',coalesce(p_terms,'{}'::text[]),'createdBy','keeper_ai'),now())
  returning * into v_collection;
  insert into public.keeper_collection_profiles(workspace_id,collection_id,terms,examples,updated_at)
  values (p_workspace_id,v_collection.id,coalesce(p_terms,'{}'::text[]),0,now())
  on conflict (workspace_id,collection_id) do update set terms=excluded.terms,updated_at=now();
  return jsonb_build_object('id',v_collection.id,'name',v_collection.name,'description',v_collection.description,'created',true);
end;
$$;
revoke all on function public.keeper_get_or_create_ai_collection(uuid,text,text,text[]) from public, anon, authenticated;
grant execute on function public.keeper_get_or_create_ai_collection(uuid,text,text,text[]) to service_role;

create table if not exists public.keeper_media_transcript_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.keeper_media(id) on delete cascade,
  text text not null default '',
  language text,
  status text not null,
  segments jsonb not null default '[]'::jsonb,
  provider text,
  model_version text,
  failure_reason text,
  transcript_updated_at timestamptz,
  archived_at timestamptz not null default now()
);
alter table public.keeper_media_transcript_history enable row level security;
drop policy if exists "workspace reads transcript history" on public.keeper_media_transcript_history;
create policy "workspace reads transcript history" on public.keeper_media_transcript_history for select to authenticated
  using (workspace_id = auth.uid());
revoke insert, update, delete on public.keeper_media_transcript_history from anon, authenticated;

create or replace function public.keeper_reprocess_media(p_media_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_workspace uuid := auth.uid();
  v_job_id uuid;
  v_canonical_url text;
begin
  if v_workspace is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select canonical_url into v_canonical_url from public.keeper_media
  where id=p_media_id and workspace_id=v_workspace for update;
  if not found then raise exception 'MEDIA_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_payload->>'url' is distinct from v_canonical_url then
    raise exception 'CANONICAL_URL_IMMUTABLE' using errcode = '22023';
  end if;

  update public.keeper_media
  set payload = p_payload, processing_status = 'QUEUED', updated_at = now()
  where id = p_media_id and workspace_id = v_workspace;

  insert into public.keeper_media_transcript_history(
    workspace_id,media_id,text,language,status,segments,provider,model_version,failure_reason,transcript_updated_at
  )
  select workspace_id,media_id,text,language,status,segments,provider,model_version,failure_reason,updated_at
  from public.keeper_media_transcripts where workspace_id = v_workspace and media_id = p_media_id;
  delete from public.keeper_media_transcripts where workspace_id = v_workspace and media_id = p_media_id;

  insert into public.keeper_ai_jobs(workspace_id,media_id,status,attempts,available_at,locked_until,last_error,idempotency_key)
  values (v_workspace,p_media_id,'QUEUED',0,now(),null,null,'reprocess:' || p_media_id::text || ':' || gen_random_uuid()::text)
  on conflict (media_id) do update set status='QUEUED',attempts=0,available_at=now(),locked_until=null,
    last_error=null,idempotency_key=excluded.idempotency_key,updated_at=now()
  returning id into v_job_id;

  return jsonb_build_object('job_id',v_job_id,'media_id',p_media_id,'status','QUEUED');
end;
$$;
revoke all on function public.keeper_reprocess_media(uuid,jsonb) from public, anon;
grant execute on function public.keeper_reprocess_media(uuid,jsonb) to authenticated;

create or replace function public.keeper_update_media_tags(
  p_media_id uuid, p_tags text[], p_user_tags text[], p_suppressed_ai_tags text[]
) returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_workspace uuid := auth.uid();
  v_tags text[] := coalesce(p_tags,'{}'::text[]);
  v_user_tags text[] := coalesce(p_user_tags,'{}'::text[]);
  v_suppressed text[] := coalesce(p_suppressed_ai_tags,'{}'::text[]);
begin
  if v_workspace is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if cardinality(v_tags) > 24 or cardinality(v_user_tags) > 24 or cardinality(v_suppressed) > 24 then
    raise exception 'TAG_LIMIT_EXCEEDED' using errcode = '22023';
  end if;
  update public.keeper_media
  set payload = jsonb_set(
    jsonb_set(
      payload,
      '{metadata}',
      coalesce(payload->'metadata','{}'::jsonb) || jsonb_build_object('userTags',to_jsonb(v_user_tags),'suppressedAiTags',to_jsonb(v_suppressed)),
      true
    ),
    '{tags}', to_jsonb(v_tags), true
  ), updated_at=now()
  where id=p_media_id and workspace_id=v_workspace;
  if not found then raise exception 'MEDIA_NOT_FOUND' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.keeper_update_media_tags(uuid,text[],text[],text[]) from public, anon;
grant execute on function public.keeper_update_media_tags(uuid,text[],text[],text[]) to authenticated;
