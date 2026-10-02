-- Durable, workspace-scoped media, AI jobs, memory, and auditable import usage.
-- Each authenticated account currently maps to one workspace (auth.uid()).
create extension if not exists pgcrypto;

create table if not exists public.keeper_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users(id) on delete cascade,
  canonical_url text not null,
  payload jsonb not null,
  processing_status text not null default 'PENDING'
    check (processing_status in ('PENDING','TRANSCRIBING','ANALYZING','TAGGING','ORGANIZING','COMPLETED','FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, canonical_url)
);

create table if not exists public.keeper_media_transcripts (
  media_id uuid primary key references public.keeper_media(id) on delete cascade,
  workspace_id uuid not null references auth.users(id) on delete cascade,
  text text not null default '',
  language text,
  status text not null check (status in ('COMPLETED','NO_SPEECH','UNAVAILABLE','FAILED')),
  provider text,
  model_version text,
  failure_reason text,
  updated_at timestamptz not null default now()
);

create table if not exists public.keeper_media_analyses (
  media_id uuid primary key references public.keeper_media(id) on delete cascade,
  workspace_id uuid not null references auth.users(id) on delete cascade,
  summary jsonb not null default '{}'::jsonb,
  primary_topic text,
  tags text[] not null default '{}',
  collection_id text,
  confidence numeric(4,3),
  analysis jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.keeper_collections (
  workspace_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  description text,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table if not exists public.keeper_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.keeper_media(id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING','TRANSCRIBING','ANALYZING','TAGGING','ORGANIZING','COMPLETED','FAILED')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  unique (media_id)
);
create index if not exists keeper_ai_jobs_claim_idx on public.keeper_ai_jobs(status, available_at, locked_until);
create index if not exists keeper_ai_jobs_workspace_idx on public.keeper_ai_jobs(workspace_id, created_at desc);

create table if not exists public.keeper_workspace_memory (
  workspace_id uuid primary key references auth.users(id) on delete cascade,
  free_cycle_anchor timestamptz not null default now(),
  media_count bigint not null default 0,
  collection_profiles jsonb not null default '[]'::jsonb,
  assignment_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.keeper_organization_corrections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.keeper_media(id) on delete cascade,
  from_collection_id text,
  to_collection_id text,
  media_tags text[] not null default '{}',
  media_topic text,
  created_at timestamptz not null default now()
);

create table if not exists public.keeper_workspace_assignments (
  workspace_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.keeper_media(id) on delete cascade,
  collection_id text,
  topic text,
  tags text[] not null default '{}',
  assigned_at timestamptz not null default now(),
  primary key (workspace_id, media_id)
);

create table if not exists public.keeper_collection_profiles (
  workspace_id uuid not null references auth.users(id) on delete cascade,
  collection_id text not null,
  terms text[] not null default '{}',
  examples bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, collection_id),
  foreign key (workspace_id, collection_id) references public.keeper_collections(workspace_id, id) on delete cascade
);

create table if not exists public.keeper_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.keeper_media(id) on delete cascade,
  event_type text not null check (event_type in ('IMPORT_CREDIT','FREE_IMPORT')),
  amount integer not null default 1 check (amount = 1),
  plan text not null check (plan in ('free','basic','pro')),
  cycle_start timestamptz not null,
  cycle_end timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, media_id)
);
create index if not exists keeper_usage_ledger_cycle_idx on public.keeper_usage_ledger(workspace_id, cycle_start, cycle_end);

alter table public.keeper_media enable row level security;
alter table public.keeper_media_transcripts enable row level security;
alter table public.keeper_media_analyses enable row level security;
alter table public.keeper_collections enable row level security;
alter table public.keeper_ai_jobs enable row level security;
alter table public.keeper_workspace_memory enable row level security;
alter table public.keeper_organization_corrections enable row level security;
alter table public.keeper_workspace_assignments enable row level security;
alter table public.keeper_collection_profiles enable row level security;
alter table public.keeper_usage_ledger enable row level security;

-- RLS controls which rows an authenticated workspace can access; it does not
-- grant SQL table privileges. Collection sync uses the signed-in user's JWT.
grant select, insert, update, delete on public.keeper_collections to authenticated;

create policy "workspace reads media" on public.keeper_media for select to authenticated
  using (workspace_id = auth.uid());
create policy "workspace reads transcripts" on public.keeper_media_transcripts for select to authenticated
  using (workspace_id = auth.uid());
create policy "workspace reads analyses" on public.keeper_media_analyses for select to authenticated
  using (workspace_id = auth.uid());
create policy "workspace owns collections" on public.keeper_collections for all to authenticated
  using (workspace_id = auth.uid()) with check (workspace_id = auth.uid());
create policy "workspace reads jobs" on public.keeper_ai_jobs for select to authenticated
  using (workspace_id = auth.uid());
create policy "workspace owns memory" on public.keeper_workspace_memory for select to authenticated
  using (workspace_id = auth.uid());
create policy "workspace reads corrections" on public.keeper_organization_corrections for select to authenticated
  using (workspace_id = auth.uid());
create policy "workspace reads assignments" on public.keeper_workspace_assignments for select to authenticated
  using (workspace_id = auth.uid());
create policy "workspace reads collection profiles" on public.keeper_collection_profiles for select to authenticated
  using (workspace_id = auth.uid());
create policy "workspace reads usage" on public.keeper_usage_ledger for select to authenticated
  using (workspace_id = auth.uid());

revoke insert, update, delete on public.keeper_usage_ledger from anon, authenticated;
revoke insert, update, delete on public.keeper_media from anon, authenticated;
revoke insert, update, delete on public.keeper_media_transcripts from anon, authenticated;
revoke insert, update, delete on public.keeper_media_analyses from anon, authenticated;
revoke insert, update, delete on public.keeper_ai_jobs from anon, authenticated;
revoke insert, update, delete on public.keeper_workspace_memory from anon, authenticated;
revoke insert, update, delete on public.keeper_workspace_assignments from anon, authenticated;
revoke insert, update, delete on public.keeper_collection_profiles from anon, authenticated;
revoke insert, update, delete on public.keeper_organization_corrections from anon, authenticated;

-- Atomically deduplicate, enforce the active plan's quota, store the item, ledger
-- one credit, and enqueue one idempotent asynchronous AI job.
create or replace function public.keeper_import_media(
  p_canonical_url text,
  p_payload jsonb,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_workspace uuid := auth.uid();
  v_media public.keeper_media%rowtype;
  v_sub public.billing_subscriptions%rowtype;
  v_plan text := 'free';
  v_start timestamptz;
  v_end timestamptz;
  v_limit integer := 30;
  v_used integer;
begin
  if v_workspace is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if length(trim(p_canonical_url)) < 8 or p_idempotency_key is null then
    raise exception 'INVALID_IMPORT' using errcode = '22023';
  end if;

  -- Serialize quota checks per workspace to prevent simultaneous imports overspending credits.
  perform pg_advisory_xact_lock(hashtextextended(v_workspace::text, 0));

  select * into v_media from public.keeper_media
    where workspace_id = v_workspace and canonical_url = p_canonical_url for update;
  if found then return jsonb_build_object('duplicate', true, 'media_id', v_media.id, 'status', v_media.processing_status); end if;

  select * into v_sub from public.billing_subscriptions s
    where s.user_id = v_workspace and (s.status in ('trialing','authenticated','active')
      or (s.status in ('cancelled','canceled') and s.cancel_at_cycle_end))
      and coalesce(s.current_period_end, s.trial_ends_at, 'infinity'::timestamptz) > now()
    order by coalesce(s.current_period_end, s.trial_ends_at) desc limit 1;
  if found then
    v_plan := v_sub.plan;
    v_start := coalesce(v_sub.current_period_start, v_sub.created_at);
    v_end := coalesce(v_sub.current_period_end, v_sub.trial_ends_at, v_start + interval '7 days');
    if v_plan = 'basic' then
      v_limit := case when v_sub.billing_cycle = 'yearly' then 2640 else 220 end;
    else
      v_limit := -1;
    end if;
  else
    insert into public.keeper_workspace_memory(workspace_id) values (v_workspace) on conflict do nothing;
    select free_cycle_anchor + floor(extract(epoch from (now() - free_cycle_anchor)) / 604800) * interval '7 days'
      into v_start from public.keeper_workspace_memory where workspace_id = v_workspace;
    v_end := v_start + interval '7 days';
  end if;

  select count(*)::integer into v_used from public.keeper_usage_ledger
    where workspace_id = v_workspace and cycle_start = v_start and cycle_end = v_end;
  if v_limit >= 0 and v_used >= v_limit then raise exception 'CREDIT_LIMIT_REACHED' using errcode = 'P0001'; end if;

  insert into public.keeper_media(workspace_id, canonical_url, payload)
    values (v_workspace, p_canonical_url, p_payload)
    on conflict (workspace_id, canonical_url) do nothing returning * into v_media;
  if v_media.id is null then
    select * into v_media from public.keeper_media where workspace_id = v_workspace and canonical_url = p_canonical_url;
    return jsonb_build_object('duplicate', true, 'media_id', v_media.id, 'status', v_media.processing_status);
  end if;
  insert into public.keeper_usage_ledger(workspace_id, media_id, event_type, plan, cycle_start, cycle_end)
    values (v_workspace, v_media.id, case when v_plan = 'free' then 'FREE_IMPORT' else 'IMPORT_CREDIT' end, v_plan, v_start, v_end);
  insert into public.keeper_ai_jobs(workspace_id, media_id, idempotency_key)
    values (v_workspace, v_media.id, p_idempotency_key);
  return jsonb_build_object('duplicate', false, 'media_id', v_media.id, 'status', 'PENDING',
    'plan', v_plan, 'used', v_used + 1, 'remaining', case when v_limit < 0 then null else v_limit - v_used - 1 end,
    'cycle_end', v_end);
end; $$;

create or replace function public.keeper_claim_ai_job()
returns setof public.keeper_ai_jobs language plpgsql security definer set search_path = public as $$
begin
  return query with candidate as (
    select id from public.keeper_ai_jobs where status in ('PENDING','TRANSCRIBING','ANALYZING','TAGGING','ORGANIZING')
      and available_at <= now() and (locked_until is null or locked_until < now())
    order by created_at for update skip locked limit 1
  ) update public.keeper_ai_jobs j set status = 'TRANSCRIBING', attempts = attempts + 1,
    locked_until = now() + interval '5 minutes', updated_at = now()
    from candidate where j.id = candidate.id returning j.*;
end; $$;
revoke all on function public.keeper_claim_ai_job() from public, anon, authenticated;
grant execute on function public.keeper_claim_ai_job() to service_role;
grant execute on function public.keeper_import_media(text,jsonb,text) to authenticated;
revoke all on function public.keeper_import_media(text,jsonb,text) from public, anon;

create or replace function public.keeper_update_media_collection(p_media_id uuid, p_collection_id text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_workspace uuid := auth.uid();
  v_payload jsonb;
  v_from_collection text;
  v_tags text[];
  v_topic text;
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
  update public.keeper_media set payload = jsonb_set(jsonb_set(v_payload, '{collectionId}', coalesce(to_jsonb(p_collection_id),'null'::jsonb), true),
    '{collections}', case when p_collection_id is null then '[]'::jsonb else jsonb_build_array(p_collection_id) end, true), updated_at = now()
    where id = p_media_id and workspace_id = v_workspace;
  update public.keeper_media_analyses set collection_id = p_collection_id, updated_at = now()
    where media_id = p_media_id and workspace_id = v_workspace;
  insert into public.keeper_organization_corrections(workspace_id,media_id,from_collection_id,to_collection_id,media_tags,media_topic)
    values (v_workspace,p_media_id,v_from_collection,p_collection_id,v_tags,v_topic);
end; $$;
revoke all on function public.keeper_update_media_collection(uuid,text) from public, anon;
grant execute on function public.keeper_update_media_collection(uuid,text) to authenticated;

create or replace function public.keeper_record_ai_assignment(
  p_workspace_id uuid, p_media_id uuid, p_collection_id text, p_topic text, p_tags text[]
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_inserted integer;
begin
  if not exists (select 1 from public.keeper_media where id = p_media_id and workspace_id = p_workspace_id) then
    raise exception 'MEDIA_NOT_FOUND';
  end if;
  insert into public.keeper_workspace_assignments(workspace_id,media_id,collection_id,topic,tags)
  values (p_workspace_id,p_media_id,p_collection_id,p_topic,coalesce(p_tags,'{}')) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    insert into public.keeper_workspace_memory(workspace_id, media_count, assignment_history, collection_profiles)
    values (p_workspace_id, 1,
      jsonb_build_array(jsonb_build_object('mediaId',p_media_id,'collectionId',p_collection_id,'topic',p_topic,'tags',p_tags,'at',now())),
      case when p_collection_id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('collectionId',p_collection_id,'topic',p_topic,'tags',p_tags)) end)
    on conflict (workspace_id) do update set
      media_count = public.keeper_workspace_memory.media_count + 1,
      assignment_history = (select coalesce(jsonb_agg(recent.value order by recent.ordinality), '[]'::jsonb)
        from (select value, ordinality from jsonb_array_elements(public.keeper_workspace_memory.assignment_history || excluded.assignment_history)
          with ordinality order by ordinality desc limit 500) recent),
      collection_profiles = public.keeper_workspace_memory.collection_profiles,
      updated_at = now();
    if p_collection_id is not null then
      insert into public.keeper_collection_profiles(workspace_id,collection_id,terms,examples)
      values (p_workspace_id,p_collection_id,array_remove(coalesce(p_tags,'{}') || coalesce(array[p_topic], '{}'),null),1)
      on conflict (workspace_id,collection_id) do update set
        terms = (select array_agg(term) from (select distinct unnest(public.keeper_collection_profiles.terms || excluded.terms) as term limit 500) terms_limited),
        examples = public.keeper_collection_profiles.examples + 1,
        updated_at = now();
    end if;
  end if;
end; $$;
revoke all on function public.keeper_record_ai_assignment(uuid,uuid,text,text,text[]) from public, anon, authenticated;
grant execute on function public.keeper_record_ai_assignment(uuid,uuid,text,text,text[]) to service_role;
