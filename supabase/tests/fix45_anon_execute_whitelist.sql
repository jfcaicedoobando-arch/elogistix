-- Fase 5 · FIX-45 · Regresión: solo la whitelist de RPCs públicas debe ser
-- ejecutable por el rol `anon`. Cualquier otra función SECURITY DEFINER
-- expuesta a anon es una fuga de superficie de ataque.
--
-- Ejecutar con:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix45_anon_execute_whitelist.sql
--
-- Falla (con RAISE) si aparece cualquier función fuera de la whitelist.

DO $$
DECLARE
  fuera text[];
BEGIN
  SELECT array_agg(p.proname ORDER BY p.proname)
    INTO fuera
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
      'is_demo_user',
      -- v13.319.1: helper de RLS usado en policies. Para anon, auth.uid() es NULL
      -- y la consulta devuelve NULL sin exponer datos. Concedido a anon para
      -- evitar 42501 en rutas públicas / sesiones expiradas que evalúan policies.
      'current_user_org_id'
    );
  IF fuera IS NOT NULL AND array_length(fuera, 1) > 0 THEN
    RAISE EXCEPTION 'FIX-45 REGRESIÓN: funciones SECURITY DEFINER ejecutables por anon fuera de whitelist: %', fuera;
  END IF;
  RAISE NOTICE 'FIX-45 OK — solo whitelist expuesta a anon.';
END $$;
