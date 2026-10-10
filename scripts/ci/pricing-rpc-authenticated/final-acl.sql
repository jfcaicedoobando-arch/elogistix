DO $final_acl$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('crm_vincular_cotizacion_cliente_pricing','guard_cotizacion_origen_pricing')
 LOOP
  IF has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE') OR has_function_privilege('service_role',f.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'Assertions left candidate application EXECUTE enabled';
  END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('postgres','anon','authenticated','service_role','authenticator','supabase_admin','supabase_auth_admin','dashboard_user','sandbox_exec','supabase_privileged_role') AND rolcanlogin) THEN
  RAISE EXCEPTION 'A simulated role was left LOGIN-enabled';
 END IF;
END
$final_acl$;
