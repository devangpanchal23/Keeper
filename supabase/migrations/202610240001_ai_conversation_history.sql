create table if not exists public.keeper_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 120),
  selected_collection_id text not null default 'all',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists keeper_ai_conversations_workspace_updated_idx
  on public.keeper_ai_conversations(workspace_id, updated_at desc);

create table if not exists public.keeper_ai_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.keeper_ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 12000),
  status text not null default 'complete' check (status in ('complete', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists keeper_ai_messages_conversation_created_idx
  on public.keeper_ai_messages(workspace_id, conversation_id, created_at asc);

alter table public.keeper_ai_conversations enable row level security;
alter table public.keeper_ai_messages enable row level security;

revoke all on public.keeper_ai_conversations from anon;
revoke all on public.keeper_ai_messages from anon;
grant select, insert, update, delete on public.keeper_ai_conversations to authenticated;
grant select, insert, update, delete on public.keeper_ai_messages to authenticated;

create policy "workspace owns AI conversations" on public.keeper_ai_conversations for all to authenticated
  using (workspace_id = auth.uid()) with check (workspace_id = auth.uid());
create policy "workspace owns AI messages" on public.keeper_ai_messages for all to authenticated
  using (workspace_id = auth.uid()) with check (workspace_id = auth.uid());
