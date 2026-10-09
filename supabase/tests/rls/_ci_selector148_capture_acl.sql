-- Scoped exception to the CI blanket GRANT. Assert the migration's own ACL
-- BEFORE any repair, so CI cannot mask an unsafe release. No role/table changes.
CREATE TEMP TABLE _ci_selector148_acl (enabled boolean NOT NULL, function_oid oid NOT NULL);
DO $selector_acl$
DECLARE p pg_proc; enabled boolean;
BEGIN
  SELECT * INTO p FROM pg_proc
  WHERE oid=to_regprocedure('public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)');
  IF NOT FOUND THEN RETURN; END IF; -- pre-installer disposable template only
  IF p.prosrc ~ '_selector148_enabled CONSTANT boolean := false;' THEN enabled:=false;
  ELSIF p.prosrc ~ '_selector148_enabled CONSTANT boolean := true;' THEN enabled:=true;
  ELSE RAISE EXCEPTION 'SELECTOR148: missing literal rollout gate'; END IF;
  IF p.proowner <> 'postgres'::regrole OR NOT p.prosecdef OR p.provolatile <> 's'
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
    OR has_function_privilege('authenticated',p.oid,'EXECUTE') IS DISTINCT FROM enabled
    OR has_function_privilege('anon',p.oid,'EXECUTE')
    OR has_function_privilege('service_role',p.oid,'EXECUTE')
    OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE a.privilege_type='EXECUTE' AND (a.grantee NOT IN (p.proowner,'authenticated'::regrole)
        OR (a.grantee='authenticated'::regrole AND (NOT enabled OR a.is_grantable))))
  THEN RAISE EXCEPTION 'SELECTOR148: migration ACL/owner/security differs from reviewed contract'; END IF;
  INSERT INTO _ci_selector148_acl VALUES(enabled,p.oid);
END $selector_acl$;
