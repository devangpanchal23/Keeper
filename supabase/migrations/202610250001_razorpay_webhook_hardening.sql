alter table public.razorpay_webhook_events
  add column if not exists processed_at timestamptz;

alter table public.razorpay_webhook_events
  alter column processed_at drop default,
  alter column processed_at drop not null;

create table if not exists public.billing_payment_failures (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique
    references public.razorpay_webhook_events(event_id) on delete cascade,
  razorpay_payment_id text not null,
  razorpay_invoice_id text,
  subscription_id uuid
    references public.billing_subscriptions(id) on delete set null,
  amount integer,
  currency text,
  error_code text,
  error_reason text,
  created_at timestamptz not null default now()
);

create index if not exists billing_payment_failures_subscription_idx
  on public.billing_payment_failures(subscription_id, created_at desc);

alter table public.billing_payment_failures enable row level security;
revoke all on public.billing_payment_failures from anon, authenticated;

-- Rollback (manual only, after no event rows have a null processed_at):
-- drop index if exists public.billing_payment_failures_subscription_idx;
-- drop table if exists public.billing_payment_failures;
-- update public.razorpay_webhook_events set processed_at = now() where processed_at is null;
-- alter table public.razorpay_webhook_events alter column processed_at set default now();
-- alter table public.razorpay_webhook_events alter column processed_at set not null;
