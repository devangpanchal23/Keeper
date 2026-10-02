-- Allow signed-in users to sync only their own collections. The table's RLS
-- policy in 202610070001_ai_media_architect.sql remains the tenant boundary.
grant select, insert, update, delete on table public.keeper_collections to authenticated;
