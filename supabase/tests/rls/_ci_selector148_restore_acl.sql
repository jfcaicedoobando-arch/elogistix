-- Restore only this RPC to the already-verified rollout ACL after CI's GRANT.
-- It is deliberately NOT part of the service-role-only catalog.
DO $selector_acl$
DECLARE state record;
BEGIN
  FOR state IN SELECT * FROM _ci_selector148_acl LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',state.function_oid::regprocedure);
    IF state.enabled THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',state.function_oid::regprocedure);
    END IF;
    IF has_function_privilege('authenticated',state.function_oid,'EXECUTE') IS DISTINCT FROM state.enabled
      OR has_function_privilege('anon',state.function_oid,'EXECUTE')
      OR has_function_privilege('service_role',state.function_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'SELECTOR148: CI could not restore exact rollout ACL';
    END IF;
  END LOOP;
END $selector_acl$;
DROP TABLE _ci_selector148_acl;
