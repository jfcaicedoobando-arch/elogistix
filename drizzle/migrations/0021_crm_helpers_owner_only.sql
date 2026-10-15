-- Canonical forward after 0020. One atomic statement; runner owns its transaction/ledger.
-- Only service_role EXECUTE on the two named helpers changes. No grants or body rewrites.
-- Runtime identities are resolved here; no private installation contract is embedded.
-- F2 transient grant-option normalization remains an operational limitation.
-- Apply in a target-specific DDL/ACL window held through postflight.
DO $crm_acl$
DECLARE
  expected_hashes constant jsonb := $source_hashes${"_crm_empresa_no_borrar_cliente": "035a8b240ef8c12fcb21136c15a238635b6ed051a7007da34d60c64f8bb494af", "_crm_empresa_no_delete_fisico": "1b094604d2ce83060257fdbfaf4e49440ce7c38dbf833b3fec1f5f69fe4c788c"}$source_hashes$::jsonb;
  f jsonb;
  actual jsonb;
  captured jsonb;
  captured_acl aclitem[];
  snapshot_rows jsonb;
  before_rows jsonb;
  after_rows jsonb;
  before_links jsonb;
  after_links jsonb;
  before_aux jsonb;
  after_aux jsonb;
  expected_owner oid := pg_catalog.to_regrole('postgres');
  service_oid oid := pg_catalog.to_regrole('service_role');
  target_oids oid[];
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  PERFORM pg_catalog.set_config('lock_timeout','3s',true);
  PERFORM pg_catalog.set_config('statement_timeout','20s',true);
  IF current_user <> 'postgres' OR current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'CRM_ACL_CONTEXT_MISMATCH';
  END IF;
  IF expected_owner IS NULL OR service_oid IS NULL THEN RAISE EXCEPTION 'CRM_ACL_ROLE_MISSING'; END IF;
  -- Cooperative only; row and relation locks below supply concrete exclusion.
  IF NOT pg_catalog.pg_try_advisory_xact_lock(817401,817402) THEN
    RAISE EXCEPTION 'CRM_ACL_BUSY';
  END IF;
  LOCK TABLE ONLY public.crm_empresas IN SHARE UPDATE EXCLUSIVE MODE NOWAIT;
  SELECT jsonb_build_object('relkind',relkind,'relispartition',relispartition,'owner',pg_catalog.pg_get_userbyid(relowner))
    INTO actual FROM pg_catalog.pg_class WHERE oid='public.crm_empresas'::regclass;
  IF actual IS DISTINCT FROM '{"relkind":"r","relispartition":false,"owner":"postgres"}'::jsonb THEN RAISE EXCEPTION 'CRM_ACL_RELATION_DRIFT'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_inherits WHERE inhparent='public.crm_empresas'::regclass OR inhrelid='public.crm_empresas'::regclass) THEN
    RAISE EXCEPTION 'CRM_ACL_INHERITANCE_UNSUPPORTED';
  END IF;
  target_oids := ARRAY[
    pg_catalog.to_regprocedure('public._crm_empresa_no_borrar_cliente()')::oid,
    pg_catalog.to_regprocedure('public._crm_empresa_no_delete_fisico()')::oid];
  IF array_position(target_oids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'CRM_ACL_IDENTITY_DRIFT'; END IF;
  -- One coherent statement snapshot: never recapture an unvalidated baseline.
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) INTO snapshot_rows
    FROM pg_catalog.pg_proc p WHERE p.oid=ANY(target_oids);
  IF jsonb_array_length(snapshot_rows) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'CRM_ACL_IDENTITY_DRIFT';
  END IF;
  FOR captured IN SELECT value FROM jsonb_array_elements(snapshot_rows) LOOP
    -- Public source contract, independent of any installation's object identities.
    IF encode(sha256(convert_to(captured->>'prosrc','UTF8')),'hex')
         IS DISTINCT FROM expected_hashes->>(captured->>'proname')
      OR captured->>'proname' NOT IN ('_crm_empresa_no_borrar_cliente','_crm_empresa_no_delete_fisico')
      OR (captured->>'pronamespace')::oid <> 'public'::regnamespace
      OR (captured->>'prolang')::oid <> (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
      OR (captured->>'prorettype')::oid <> 'pg_catalog.trigger'::regtype
      OR captured->>'prokind' <> 'f' OR (captured->>'pronargs')::integer <> 0
      OR (captured->>'pronargdefaults')::integer <> 0
      OR captured->'proargtypes' <> '[]'::jsonb
      OR captured->'proallargtypes' <> 'null'::jsonb
      OR captured->'proargmodes' <> 'null'::jsonb OR captured->'proargnames' <> 'null'::jsonb
      OR captured->'proargdefaults' <> 'null'::jsonb OR captured->'protrftypes' <> 'null'::jsonb
      OR (captured->>'provariadic')::oid <> 0 OR (captured->>'prosupport')::text <> '-'
      OR captured->'prosecdef' <> 'false'::jsonb OR captured->'proleakproof' <> 'false'::jsonb
      OR captured->'proisstrict' <> 'false'::jsonb OR captured->'proretset' <> 'false'::jsonb
      OR captured->>'provolatile' <> 'v' OR captured->>'proparallel' <> 'u'
      OR (captured->>'procost')::numeric <> 100 OR (captured->>'prorows')::numeric <> 0
      OR captured->'proconfig' <> '["search_path=public"]'::jsonb
      OR captured->'probin' <> 'null'::jsonb OR captured->'prosqlbody' <> 'null'::jsonb THEN
      RAISE EXCEPTION 'CRM_ACL_FUNCTION_DRIFT';
    END IF;
    IF captured->'proacl'='null'::jsonb THEN RAISE EXCEPTION 'CRM_ACL_UNEXPECTED_ACL'; END IF;
    SELECT array_agg(value::aclitem) INTO captured_acl
      FROM jsonb_array_elements_text(captured->'proacl');
    IF captured_acl IS NULL OR (captured->>'proowner')::oid<>expected_owner
      OR (SELECT count(*) FROM pg_catalog.aclexplode(captured_acl)) NOT IN (1,2)
      OR (SELECT count(*) FROM pg_catalog.aclexplode(captured_acl) a WHERE a.grantee=expected_owner)<>1
      OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(captured_acl) a
        WHERE a.grantor<>expected_owner OR a.grantee NOT IN(expected_owner,service_oid)
           OR a.privilege_type<>'EXECUTE' OR a.is_grantable) THEN
      RAISE EXCEPTION 'CRM_ACL_UNEXPECTED_ACL';
    END IF;
  END LOOP;
  -- Derive only from the validated snapshot, with no second pg_proc read.
  SELECT jsonb_agg(value-'proacl' ORDER BY (value->>'oid')::oid) INTO before_rows
    FROM jsonb_array_elements(snapshot_rows);
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.oid),'[]'::jsonb) INTO before_links
    FROM pg_catalog.pg_trigger t WHERE t.tgfoid=ANY(target_oids);
  IF jsonb_array_length(before_links) <> 2 OR EXISTS (
    SELECT 1 FROM jsonb_to_recordset(before_links) AS t(tgfoid oid,tgrelid oid,tgisinternal boolean,
      tgenabled text,tgconstraint oid,tgconstrrelid oid,tgconstrindid oid,tgparentid oid,
      tgdeferrable boolean,tginitdeferred boolean,tgnargs integer,tgargs text,tgqual jsonb,
      tgoldtable text,tgnewtable text,tgname text,tgtype integer,tgattr jsonb)
    WHERE (
      t.tgrelid <> 'public.crm_empresas'::regclass OR t.tgisinternal
      OR t.tgenabled <> 'O' OR t.tgconstraint <> 0 OR t.tgconstrrelid <> 0
      OR t.tgconstrindid <> 0 OR t.tgparentid <> 0
      OR t.tgdeferrable OR t.tginitdeferred OR t.tgnargs <> 0
      OR t.tgargs <> chr(92)||'x' OR t.tgqual IS NOT NULL
      OR t.tgoldtable IS NOT NULL OR t.tgnewtable IS NOT NULL
      OR NOT ((t.tgfoid=target_oids[1] AND t.tgname='trg_crm_empresa_no_borrar_cliente'
        AND t.tgtype=19 AND t.tgattr=(SELECT jsonb_build_array(attnum) FROM pg_catalog.pg_attribute
          WHERE attrelid='public.crm_empresas'::regclass AND attname='deleted_at' AND NOT attisdropped))
        OR (t.tgfoid=target_oids[2] AND t.tgname='trg_crm_empresa_no_delete_fisico'
          AND t.tgtype=11 AND t.tgattr='[]'::jsonb)))) THEN
    RAISE EXCEPTION 'CRM_ACL_TRIGGER_DRIFT';
  END IF;
  SELECT jsonb_build_object(
    'comments',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.objoid,d.objsubid),'[]'::jsonb) FROM pg_catalog.pg_description d WHERE d.classoid='pg_catalog.pg_proc'::regclass AND d.objoid=ANY(target_oids)),
    'labels',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.objoid,s.objsubid,s.provider),'[]'::jsonb) FROM pg_catalog.pg_seclabel s WHERE s.classoid='pg_catalog.pg_proc'::regclass AND s.objoid=ANY(target_oids)),
    'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]'::jsonb) FROM pg_catalog.pg_depend d WHERE (d.classid='pg_catalog.pg_proc'::regclass AND d.objid=ANY(target_oids)) OR (d.refclassid='pg_catalog.pg_proc'::regclass AND d.refobjid=ANY(target_oids)))
  ) INTO before_aux;
  -- RESTRICT, never CASCADE. No CREATE/ALTER/DROP FUNCTION or trigger recreation.
  -- Execute even if already owner-only: acquire the catalog update lock on replay.
  REVOKE EXECUTE ON FUNCTION public._crm_empresa_no_borrar_cliente() FROM service_role RESTRICT;
  REVOKE EXECUTE ON FUNCTION public._crm_empresa_no_delete_fisico() FROM service_role RESTRICT;
  SELECT jsonb_agg(to_jsonb(p)-'proacl' ORDER BY p.oid) INTO after_rows
    FROM pg_catalog.pg_proc p WHERE p.oid=ANY(target_oids);
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.oid),'[]'::jsonb) INTO after_links
    FROM pg_catalog.pg_trigger t WHERE t.tgfoid=ANY(target_oids);
  SELECT jsonb_build_object(
    'comments',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.objoid,d.objsubid),'[]'::jsonb) FROM pg_catalog.pg_description d WHERE d.classoid='pg_catalog.pg_proc'::regclass AND d.objoid=ANY(target_oids)),
    'labels',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.objoid,s.objsubid,s.provider),'[]'::jsonb) FROM pg_catalog.pg_seclabel s WHERE s.classoid='pg_catalog.pg_proc'::regclass AND s.objoid=ANY(target_oids)),
    'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]'::jsonb) FROM pg_catalog.pg_depend d WHERE (d.classid='pg_catalog.pg_proc'::regclass AND d.objid=ANY(target_oids)) OR (d.refclassid='pg_catalog.pg_proc'::regclass AND d.refobjid=ANY(target_oids)))
  ) INTO after_aux;
  -- Both REVOKEs have returned. Validate against the immutable contract again,
  -- under their catalog update locks; never accept concurrent DDL as baseline.
  IF jsonb_array_length(after_rows) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'CRM_ACL_CONCURRENT_METADATA_DRIFT';
  END IF;
  IF before_rows IS DISTINCT FROM after_rows OR before_links IS DISTINCT FROM after_links OR before_aux IS DISTINCT FROM after_aux THEN
    RAISE EXCEPTION 'CRM_ACL_CONCURRENT_METADATA_DRIFT';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=ANY(target_oids)
    AND (p.proacl IS DISTINCT FROM ARRAY['postgres=X/postgres']::aclitem[]
      OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN
    RAISE EXCEPTION 'CRM_ACL_POSTCONDITION_FAILED';
  END IF;
END
$crm_acl$;
