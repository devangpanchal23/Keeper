create extension if not exists pgcrypto;

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  razorpay_subscription_id text not null unique,
  razorpay_plan_id text not null,
  plan text not null check (plan in ('basic', 'pro')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  amount integer not null check (amount >= 100),
  currency text not null default 'INR',
  status text not null default 'created',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_payment_at timestamptz,
  cancel_at_cycle_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_plan_catalog (
  plan_key text primary key check (plan_key in ('basic_monthly', 'basic_yearly', 'pro_monthly', 'pro_yearly')),
  razorpay_plan_id text not null unique,
  amount integer not null check (amount >= 100),
  created_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_user_status_idx
  on public.billing_subscriptions(user_id, status, current_period_end desc);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  razorpay_payment_id text not null unique,
  razorpay_invoice_id text,
  receipt_url text,
  amount integer not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null,
  plan text not null check (plan in ('basic', 'pro')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists billing_payments_user_created_idx
  on public.billing_payments(user_id, created_at desc);

create table if not exists public.razorpay_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.razorpay_webhook_events enable row level security;
alter table public.billing_plan_catalog enable row level security;

create policy "Users can read their billing subscriptions"
  on public.billing_subscriptions for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can read their billing payments"
  on public.billing_payments for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.billing_subscriptions from anon, authenticated;
revoke insert, update, delete on public.billing_payments from anon, authenticated;
revoke all on public.razorpay_webhook_events from anon, authenticated;
revoke all on public.billing_plan_catalog from anon, authenticated;
