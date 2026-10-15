#!/usr/bin/env python3
"""Build NEW review proposal from a pinned metadata contract, never infer live approval."""
import json, pathlib, sys
root=pathlib.Path(__file__).parent
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text())
functions=manifest['functions']; triggers=manifest['triggers']; relation=manifest['relation']
assert len(functions)==2 and len(triggers)==2
assert [x['signature'] for x in functions]==['public._crm_empresa_no_borrar_cliente()', 'public._crm_empresa_no_delete_fisico()']
expected=json.dumps(manifest,separators=(',',':'),ensure_ascii=False)
assert '$contract$' not in expected
sql='''-- NEW proposal, reconstructed 2026-10-15. Not the lost historical artifact.
-- Run only after independent review and PostgreSQL 17.6 fixture validation.
-- Atomic standalone transaction; do not split this file or suppress errors.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';
SET LOCAL search_path = pg_catalog;
DO $crm_acl$
DECLARE
  contract constant jsonb := $contract$CONTRACT$contract$::jsonb;
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
  IF current_user <> 'postgres' OR current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'CRM_ACL_CONTEXT_MISMATCH';
  END IF;
  IF expected_owner IS NULL OR service_oid IS NULL THEN RAISE EXCEPTION 'CRM_ACL_ROLE_MISSING'; END IF;
  -- Cooperative only; row and relation locks below supply concrete exclusion.
  IF NOT pg_catalog.pg_try_advisory_xact_lock(817401,817402) THEN
    RAISE EXCEPTION 'CRM_ACL_BUSY';
  END IF;
  LOCK TABLE ONLY public.crm_empresas IN SHARE UPDATE EXCLUSIVE MODE NOWAIT;
  SELECT jsonb_build_object('oid',oid,'relkind',relkind,'relispartition',relispartition)
    INTO actual FROM pg_catalog.pg_class WHERE oid='public.crm_empresas'::regclass;
  IF actual IS DISTINCT FROM contract->'relation' THEN RAISE EXCEPTION 'CRM_ACL_RELATION_DRIFT'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_inherits WHERE inhparent='public.crm_empresas'::regclass OR inhrelid='public.crm_empresas'::regclass) THEN
    RAISE EXCEPTION 'CRM_ACL_INHERITANCE_UNSUPPORTED';
  END IF;
  SELECT array_agg((j->>'oid')::oid ORDER BY (j->>'oid')::oid) INTO target_oids
    FROM jsonb_array_elements(contract->'functions') j;
  -- One coherent statement snapshot: never recapture an unvalidated baseline.
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) INTO snapshot_rows
    FROM pg_catalog.pg_proc p WHERE p.oid=ANY(target_oids);
  IF jsonb_array_length(snapshot_rows) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'CRM_ACL_IDENTITY_DRIFT';
  END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(contract->'functions') LOOP
    SELECT value INTO captured FROM jsonb_array_elements(snapshot_rows)
      WHERE (value->>'oid')::oid=(f->>'oid')::oid;
    actual := jsonb_build_object(
      'metadata',captured-ARRAY['proacl','prosrc','probin','prosqlbody'],
      'prosrc_sha256',encode(sha256(convert_to(captured->>'prosrc','UTF8')),'hex'),
      'probin_is_null',captured->'probin'='null'::jsonb,
      'prosqlbody_is_null',captured->'prosqlbody'='null'::jsonb);
    IF actual IS DISTINCT FROM f->'expected' THEN RAISE EXCEPTION 'CRM_ACL_FUNCTION_DRIFT'; END IF;
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
  IF before_links IS DISTINCT FROM contract->'triggers' THEN RAISE EXCEPTION 'CRM_ACL_TRIGGER_DRIFT'; END IF;
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
  FOR f IN SELECT value FROM jsonb_array_elements(contract->'functions') LOOP
    SELECT value INTO captured FROM jsonb_array_elements(after_rows)
      WHERE (value->>'oid')::oid=(f->>'oid')::oid;
    actual := jsonb_build_object(
      'metadata',captured-ARRAY['proacl','prosrc','probin','prosqlbody'],
      'prosrc_sha256',encode(sha256(convert_to(captured->>'prosrc','UTF8')),'hex'),
      'probin_is_null',captured->'probin'='null'::jsonb,
      'prosqlbody_is_null',captured->'prosqlbody'='null'::jsonb);
    IF actual IS DISTINCT FROM f->'expected' THEN
      RAISE EXCEPTION 'CRM_ACL_CONCURRENT_METADATA_DRIFT';
    END IF;
  END LOOP;
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
COMMIT;
'''.replace('CONTRACT',expected)
pathlib.Path(sys.argv[2]).write_text(sql)
