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
      -- fix3 (20260831200400): handle_new_user_signup salió de la whitelist —
      -- es función trigger de auth.users, nadie la invoca directo y los
      -- triggers no requieren EXECUTE (corren como owner). Se revocó de
      -- PUBLIC/anon/authenticated; si alguien la re-concede, este test truena.
      'is_demo_user',
      -- v13.319.1: helper de RLS usado en policies. Para anon, auth.uid() es NULL
      -- y la consulta devuelve NULL sin exponer datos. Concedido a anon para
      -- evitar 42501 en rutas públicas / sesiones expiradas que evalúan policies.
      'current_user_org_id',
      -- v13.320.31: helpers SECURITY DEFINER usados por policies del Portal del
      -- Agente y validaciones de embarque. Todos devuelven NULL/false cuando
      -- auth.uid() es NULL, por lo que anon no obtiene datos; sólo evita 42501
      -- al evaluar las policies desde sesiones anónimas o expiradas.
      'has_role',
      -- v13.452.0: has_any_role reemplaza cadenas de 5 llamadas a has_role en
      -- las policies calientes (perf RLS). Misma semántica: false con uid NULL.
      'has_any_role',
      'current_agente_id',
      'current_agente_org'
    );

  IF fuera IS NOT NULL AND array_length(fuera, 1) > 0 THEN
    RAISE EXCEPTION 'FIX-45 REGRESIÓN: funciones SECURITY DEFINER ejecutables por anon fuera de whitelist: %', fuera;
  END IF;
  RAISE NOTICE 'FIX-45 OK — solo whitelist expuesta a anon.';
END $$;

-- fix3 (tanda 3): las 4 RPCs públicas del portal/tracking/logging deben
-- conservar su rate limit a nivel BD (check_ratelimit). Es una regresión
-- conocida que una re-emisión posterior lo pise (le pasó a
-- portal_obtener_proforma_por_token en 20260817155946, drift BL-11).
DO $$
DECLARE
  sin_rl text[];
BEGIN
  SELECT array_agg(p.proname ORDER BY p.proname)
    INTO sin_rl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'portal_obtener_proforma_por_token',
      'portal_responder_por_token',
      'get_tracking_public',
      'log_client_error_v1'
    )
    AND p.prosrc NOT ILIKE '%check_ratelimit%';

  IF sin_rl IS NOT NULL AND array_length(sin_rl, 1) > 0 THEN
    RAISE EXCEPTION 'FIX-45 RATELIMIT REGRESIÓN: RPCs públicas sin check_ratelimit en el cuerpo: %', sin_rl;
  END IF;
  RAISE NOTICE 'FIX-45 RATELIMIT OK — las 4 RPCs públicas conservan check_ratelimit.';
END $$;
