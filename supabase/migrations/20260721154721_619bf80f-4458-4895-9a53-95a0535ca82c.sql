-- FIX-45 (Fase 5) · Revocar EXECUTE de rol anon en RPCs de negocio.
-- Mantiene EXECUTE a authenticated y service_role.
-- Whitelist: portal_*, get_tracking_public, log_client_error_v1,
-- check_ratelimit, handle_new_user_signup, is_demo_user.

DO $$
DECLARE
  fn_signature text;
BEGIN
  FOR fn_signature IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname NOT IN (
        'portal_obtener_proforma_por_token',
        'portal_responder_por_token',
        'get_tracking_public',
        'log_client_error_v1',
        'check_ratelimit',
        'handle_new_user_signup',
        'is_demo_user'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn_signature);
  END LOOP;
END $$;