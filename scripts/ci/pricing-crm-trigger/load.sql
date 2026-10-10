\set ON_ERROR_STOP on
BEGIN;
\i '/bundle/bootstrap-synthetic.sql'
\i '/bundle/auth-uid.sql'
\i '/bundle/auth-jwt.sql'
\i '/bundle/auth-role.sql'
\i '/bundle/replay.sql'
-- Revoke in the same transaction that creates the candidate, even if the bundle
-- restores platform defaults granting EXECUTE on other public functions.
DO $revoke$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('crm_vincular_cotizacion_cliente_pricing','guard_cotizacion_origen_pricing')
 LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',f.sig);
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='crm_vincular_cotizacion_cliente_pricing') THEN
  RAISE EXCEPTION 'Reviewed replay bundle did not create the candidate';
 END IF;
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='crm_vincular_cotizacion_cliente_pricing'
 LOOP
  IF has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE') OR has_function_privilege('service_role',f.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'Candidate application EXECUTE must remain revoked';
  END IF;
 END LOOP;
END
$revoke$;
COMMIT;
