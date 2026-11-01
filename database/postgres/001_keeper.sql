-- Keeper standalone PostgreSQL schema. Run against a dedicated database.
-- Supabase mode continues to use the ordered supabase/migrations files.
create extension if not exists pgcrypto;

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  razorpay_subscription_id text not null unique, razorpay_plan_id text not null,
  plan text not null check (plan in ('basic','pro')), billing_cycle text not null check (billing_cycle in ('monthly','yearly')),
  amount integer not null check (amount >= 100), currency text not null default 'INR', status text not null default 'created',
  trial_ends_at timestamptz, current_period_start timestamptz, current_period_end timestamptz, next_payment_at timestamptz,
  cancel_at_cycle_end boolean not null default false, canceled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.billing_plan_catalog (
  plan_key text primary key check (plan_key in ('basic_monthly','basic_yearly','pro_monthly','pro_yearly')),
  razorpay_plan_id text not null unique, amount integer not null check (amount >= 100), created_at timestamptz not null default now()
);
create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  razorpay_payment_id text not null unique, razorpay_invoice_id text, receipt_url text, amount integer not null check (amount >= 0),
  currency text not null default 'INR', status text not null, plan text not null check (plan in ('basic','pro')),
  billing_cycle text not null check (billing_cycle in ('monthly','yearly')), paid_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.razorpay_webhook_events (
  event_id text primary key, event_type text not null, processed_at timestamptz
);
create table if not exists public.billing_payment_failures (
  id uuid primary key default gen_random_uuid(), event_id text not null unique references public.razorpay_webhook_events(event_id) on delete cascade,
  razorpay_payment_id text not null, razorpay_invoice_id text, subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  amount integer, currency text, error_code text, error_reason text, created_at timestamptz not null default now()
);
create index if not exists billing_subscriptions_user_status_idx on public.billing_subscriptions(user_id,status,current_period_end desc);
create index if not exists billing_payments_user_created_idx on public.billing_payments(user_id,created_at desc);
create index if not exists billing_payment_failures_subscription_idx on public.billing_payment_failures(subscription_id,created_at desc);

create table if not exists public.keeper_media (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, canonical_url text not null, payload jsonb not null,
  processing_status text not null default 'PENDING', source_platform text, source_identifier text, content_fingerprint text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,canonical_url)
);
create unique index if not exists keeper_media_source_identity_unique on public.keeper_media(workspace_id,source_platform,source_identifier) where source_platform is not null and source_identifier is not null;
create index if not exists keeper_media_fingerprint_idx on public.keeper_media(workspace_id,content_fingerprint) where content_fingerprint is not null;
create or replace function public.keeper_set_media_identity()
returns trigger language plpgsql set search_path = public as $$
declare
  v_metadata jsonb := coalesce(new.payload->'metadata','{}'::jsonb);
  v_raw jsonb := coalesce(v_metadata->'rawPlatformMetadata','{}'::jsonb);
  v_text text;
begin
  new.source_platform := coalesce(new.payload->>'platform',v_metadata->>'sourcePlatform');
  new.source_identifier := coalesce(v_metadata->>'sourceIdentifier',v_metadata->>'shortcode',v_metadata->>'fbid',v_raw->>'id');
  v_text := lower(trim(concat_ws(' ',new.payload->>'title',new.payload->>'description',v_metadata->>'caption',v_metadata->>'bodyText')));
  new.content_fingerprint := case when length(v_text)>=80 then encode(digest(v_text,'sha256'),'hex') else null end;
  return new;
end;
$$;
drop trigger if exists keeper_media_identity_before_write on public.keeper_media;
create trigger keeper_media_identity_before_write before insert or update of payload on public.keeper_media
for each row execute function public.keeper_set_media_identity();
create table if not exists public.keeper_media_transcripts (
  media_id uuid primary key references public.keeper_media(id) on delete cascade, workspace_id uuid not null,
  text text not null default '', language text, status text not null, segments jsonb not null default '[]'::jsonb,
  duration_seconds numeric, confidence numeric, extraction_method text, provider text, model_version text, failure_reason text,
  updated_at timestamptz not null default now()
);
create table if not exists public.keeper_media_analyses (
  media_id uuid primary key references public.keeper_media(id) on delete cascade, workspace_id uuid not null,
  summary jsonb not null default '{}'::jsonb, primary_topic text, tags text[] not null default '{}', collection_id text,
  confidence numeric(4,3), analysis jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.keeper_collections (
  workspace_id uuid not null, id text not null, name text not null, description text, profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key(workspace_id,id)
);
create table if not exists public.keeper_ai_jobs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, media_id uuid not null unique references public.keeper_media(id) on delete cascade,
  status text not null default 'QUEUED', attempts integer not null default 0, available_at timestamptz not null default now(), locked_until timestamptz,
  last_error text, failure_code text, idempotency_key text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,idempotency_key)
);
create index if not exists keeper_ai_jobs_claim_idx on public.keeper_ai_jobs(status,available_at,locked_until);
create index if not exists keeper_ai_jobs_workspace_idx on public.keeper_ai_jobs(workspace_id,created_at desc);
create table if not exists public.keeper_workspace_memory (
  workspace_id uuid primary key, free_cycle_anchor timestamptz not null default now(), media_count bigint not null default 0,
  collection_profiles jsonb not null default '[]'::jsonb, assignment_history jsonb not null default '[]'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.keeper_organization_corrections (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, media_id uuid not null references public.keeper_media(id) on delete cascade,
  from_collection_id text, to_collection_id text, media_tags text[] not null default '{}', media_topic text, created_at timestamptz not null default now()
);
create table if not exists public.keeper_workspace_assignments (
  workspace_id uuid not null, media_id uuid not null references public.keeper_media(id) on delete cascade, collection_id text, topic text,
  tags text[] not null default '{}', assigned_at timestamptz not null default now(), primary key(workspace_id,media_id)
);
create table if not exists public.keeper_collection_profiles (
  workspace_id uuid not null, collection_id text not null, terms text[] not null default '{}', examples bigint not null default 0,
  updated_at timestamptz not null default now(), primary key(workspace_id,collection_id),
  foreign key(workspace_id,collection_id) references public.keeper_collections(workspace_id,id) on delete cascade
);
create table if not exists public.keeper_usage_ledger (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, media_id uuid not null references public.keeper_media(id) on delete cascade,
  event_type text not null check(event_type in ('IMPORT_CREDIT','FREE_IMPORT')), amount integer not null default 1 check(amount=1),
  plan text not null check(plan in ('free','basic','pro')), cycle_start timestamptz not null, cycle_end timestamptz not null,
  created_at timestamptz not null default now(), unique(workspace_id,media_id)
);
create index if not exists keeper_usage_ledger_cycle_idx on public.keeper_usage_ledger(workspace_id,cycle_start,cycle_end);
create table if not exists public.keeper_media_transcript_history (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, media_id uuid not null references public.keeper_media(id) on delete cascade,
  text text not null default '', language text, status text not null, segments jsonb not null default '[]'::jsonb, provider text, model_version text,
  failure_reason text, transcript_updated_at timestamptz, archived_at timestamptz not null default now()
);
create table if not exists public.keeper_ai_conversations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, title text not null default 'New conversation' check(char_length(title)<=120),
  selected_collection_id text not null default 'all', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists keeper_ai_conversations_workspace_updated_idx on public.keeper_ai_conversations(workspace_id,updated_at desc);
create table if not exists public.keeper_ai_messages (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, conversation_id uuid not null references public.keeper_ai_conversations(id) on delete cascade,
  role text not null check(role in ('user','assistant')), content text not null check(char_length(content)<=12000),
  status text not null default 'complete' check(status in ('complete','failed')), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists keeper_ai_messages_conversation_created_idx on public.keeper_ai_messages(workspace_id,conversation_id,created_at asc);
