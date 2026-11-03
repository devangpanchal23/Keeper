begin;

-- Keeper Open-Source Edition imports are unlimited. This forward-only replacement
-- retains the authenticated workspace boundary and historical usage/billing data;
-- it changes only future imports and their newly written ledger events.
-- Rollback requires deploying a reviewed prior function body. Reverting to the old
-- quota function can block later imports again, but does not require data deletion.
create or replace function public.keeper_import_media(
  p_canonical_url text,
  p_payload jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_workspace uuid := auth.uid();
  v_media public.keeper_media%rowtype;
  v_source_platform text := coalesce(p_payload->>'platform', p_payload#>>'{metadata,sourcePlatform}');
  v_source_identifier text := coalesce(
    p_payload#>>'{metadata,sourceIdentifier}',
    p_payload#>>'{metadata,shortcode}',
    p_payload#>>'{metadata,fbid}',
    p_payload#>>'{metadata,rawPlatformMetadata,id}'
  );
  v_cycle_start timestamptz;
  v_cycle_end timestamptz;
  v_cycle_anchor timestamptz;
  v_now timestamptz;
  v_used integer;
  v_fingerprint_text text;
  v_fingerprint text;
  v_pgcrypto_schema name;
begin
  if v_workspace is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if length(trim(p_canonical_url)) < 8 or p_idempotency_key is null then
    raise exception 'INVALID_IMPORT' using errcode = '22023';
  end if;

  -- Serialize identity/usage writes in one workspace. This also ensures that two
  -- simultaneous imports of the same fingerprint cannot both create ledger rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_workspace::text, 0));

  select * into v_media
    from public.keeper_media
   where workspace_id = v_workspace and canonical_url = p_canonical_url
   for update;
  if not found and v_source_platform is not null and v_source_identifier is not null then
    select * into v_media
      from public.keeper_media
     where workspace_id = v_workspace
       and source_platform = v_source_platform
       and source_identifier = v_source_identifier
     for update;
  end if;
  if found then
    return jsonb_build_object('duplicate', true, 'media_id', v_media.id, 'status', v_media.processing_status);
  end if;

  -- Preserve legacy fingerprint duplicate detection; fingerprint matches are no-op duplicates.
  v_fingerprint_text := lower(trim(concat_ws(
    ' ', p_payload->>'title', p_payload->>'description',
    p_payload#>>'{metadata,caption}', p_payload#>>'{metadata,bodyText}'
  )));
  if length(v_fingerprint_text) >= 80 then
    -- The migrations install pgcrypto without an explicit schema. Resolve its
    -- actual extension namespace from trusted catalogs, then quote the schema and
    -- bind all values so a writable application schema cannot shadow digest().
    select n.nspname
      into v_pgcrypto_schema
      from pg_catalog.pg_extension as e
      join pg_catalog.pg_namespace as n on n.oid = e.extnamespace
     where e.extname = 'pgcrypto';
    if v_pgcrypto_schema is null then
      raise exception 'PGCRYPTO_UNAVAILABLE' using errcode = '55000';
    end if;
    execute pg_catalog.format(
      'select pg_catalog.encode(%I.digest($1::text, $2::text), ''hex'')',
      v_pgcrypto_schema
    ) into v_fingerprint using v_fingerprint_text, 'sha256';
    select * into v_media
      from public.keeper_media
     where workspace_id = v_workspace and content_fingerprint = v_fingerprint
     limit 1 for update;
    if found then
      return jsonb_build_object('duplicate', true, 'media_id', v_media.id, 'status', v_media.processing_status);
    end if;
  end if;

  -- Match the OSS provider contract: a workspace-anchored recurring seven-day window.
  insert into public.keeper_workspace_memory(workspace_id)
  values (v_workspace)
  on conflict do nothing;
  select pg_catalog.date_trunc('milliseconds', free_cycle_anchor)
    into v_cycle_anchor
    from public.keeper_workspace_memory
   where workspace_id = v_workspace
   for update;
  v_now := pg_catalog.clock_timestamp();
  v_cycle_start := pg_catalog.to_timestamp(
    extract(epoch from v_cycle_anchor)
      + pg_catalog.floor(extract(epoch from (v_now - v_cycle_anchor)) / 604800) * 604800
  );
  v_cycle_end := pg_catalog.to_timestamp(extract(epoch from v_cycle_start) + 604800);
  select count(*)::integer into v_used
    from public.keeper_usage_ledger
   where workspace_id = v_workspace
     and cycle_start = v_cycle_start
     and cycle_end = v_cycle_end;

  insert into public.keeper_media(workspace_id, canonical_url, payload, processing_status)
  values (v_workspace, p_canonical_url, p_payload, 'QUEUED')
  on conflict do nothing
  returning * into v_media;
  if v_media.id is null then
    select * into v_media
      from public.keeper_media
     where workspace_id = v_workspace
       and (canonical_url = p_canonical_url or (
         v_source_platform is not null
         and source_platform = v_source_platform
         and v_source_identifier is not null
         and source_identifier = v_source_identifier
       ))
     limit 1;
    if v_media.id is not null then
      return jsonb_build_object('duplicate', true, 'media_id', v_media.id, 'status', v_media.processing_status);
    end if;
    raise exception 'IMPORT_CONFLICT' using errcode = '40001';
  end if;

  -- Exactly one normalized event per newly created media row. The existing unique
  -- (workspace_id, media_id) constraint plus the transaction prevents duplicates.
  insert into public.keeper_usage_ledger(
    workspace_id, media_id, event_type, plan, amount, cycle_start, cycle_end
  ) values (
    v_workspace, v_media.id, 'FREE_IMPORT', 'free', 1, v_cycle_start, v_cycle_end
  );

  insert into public.keeper_ai_jobs(workspace_id, media_id, idempotency_key, status)
  values (v_workspace, v_media.id, p_idempotency_key, 'QUEUED');

  -- Preserve the existing RPC result keys consumed by /api/ingest and clients.
  return jsonb_build_object(
    'duplicate', false,
    'media_id', v_media.id,
    'status', 'QUEUED',
    'plan', 'free',
    'used', v_used + 1,
    'remaining', null,
    'cycle_end', v_cycle_end
  );
end;
$$;

-- CREATE OR REPLACE preserves the existing owner and function ACL. Reassert the
-- same narrow grant used by the current migration: authenticated only.
revoke all on function public.keeper_import_media(text, jsonb, text) from public, anon;
grant execute on function public.keeper_import_media(text, jsonb, text) to authenticated;

commit;
