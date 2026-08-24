-- =============================================================
-- fix3_portal_proforma_ratelimit.sql · FIX3 tanda 3 (drift ronda 2)
--
-- portal_obtener_proforma_por_token fue re-emitida por BL-11
-- (20260817155946) sin check_ratelimit y como STABLE, pisando
-- 20260811231247. La migración 20260831100300 la re-emite con el rate
-- limit restaurado (30/min por IP+identidad) y VOLATILE.
--
-- Casos:
--   1. La función es VOLATILE (check_ratelimit escribe en
--      ratelimit_buckets; STABLE lo prohibiría en runtime).
--   2. El cuerpo contiene check_ratelimit (anti-drift).
--   3. Conductual: 30 llamadas con la misma IP pasan y la 31ª cae con
--      P0001 "Demasiadas solicitudes".
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix3_portal_proforma_ratelimit.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_def text;
  i int;
BEGIN
  -- 1: volatilidad.
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'portal_obtener_proforma_por_token'
     AND p.provolatile = 'v';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIX3 PROFORMA FAIL: portal_obtener_proforma_por_token debe ser VOLATILE (check_ratelimit escribe buckets)';
  END IF;

  -- 2: el cuerpo incluye el rate limit (guardia anti-drift).
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'portal_obtener_proforma_por_token';
  IF v_def NOT ILIKE '%check_ratelimit%' THEN
    RAISE EXCEPTION 'FIX3 PROFORMA FAIL: portal_obtener_proforma_por_token no contiene check_ratelimit (drift re-introducido)';
  END IF;

  -- 3: conductual — misma IP, 31ª llamada rechazada.
  PERFORM set_config('request.headers', '{"x-forwarded-for":"198.51.100.77"}', true);
  FOR i IN 1..30 LOOP
    -- Token inexistente: devuelve jsonb de error, pero el rate limit corre
    -- primero y cuenta la llamada.
    PERFORM public.portal_obtener_proforma_por_token(gen_random_uuid());
  END LOOP;

  BEGIN
    PERFORM public.portal_obtener_proforma_por_token(gen_random_uuid());
    RAISE EXCEPTION 'FIX3 PROFORMA FAIL: la llamada 31 en el mismo minuto NO fue limitada';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Demasiadas solicitudes%' THEN
        RAISE; -- propaga el FAIL del intento anterior
      END IF;
  END;

  RAISE NOTICE 'FIX3 proforma rate limit OK — VOLATILE, check_ratelimit presente, 31ª llamada rechazada.';
END $$;

ROLLBACK;
