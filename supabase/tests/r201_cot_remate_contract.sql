-- =============================================================
-- r201_cot_remate_contract.sql · Contrato del remate R201 (cotización → embarque)
--
-- Formato: DO $$ + pg_temp.assert (convención del runner de guards).
-- No usa pgTAP: el runner `scripts/ci/run-guards.sh` corre psql plano sobre el
-- snapshot restaurado y la extensión pgtap no está disponible ahí.
--
-- Comprobaciones (idénticas a la versión previa):
--   · conceptos_costo.cotizacion_costo_origen_id existe, es nullable y apunta
--     por FK a cotizacion_costos(id).
--   · Firmas y privilegios: helper y core privados (sin EXECUTE para
--     authenticated, con EXECUTE para service_role), RPC públicas con EXECUTE
--     para authenticated.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/r201_cot_remate_contract.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_nullable text;
  v_oid regprocedure;
BEGIN
  -- 1) Identidad del costo fuente ------------------------------------------
  SELECT is_nullable INTO v_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'conceptos_costo'
    AND column_name = 'cotizacion_costo_origen_id';

  PERFORM pg_temp.assert(v_nullable IS NOT NULL,
    'R201-COT-01: falta public.conceptos_costo.cotizacion_costo_origen_id');
  PERFORM pg_temp.assert(v_nullable = 'YES',
    'La identidad debe ser nullable (costos manuales e históricos)');

  PERFORM pg_temp.assert(EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_class r ON r.oid = c.confrelid
    JOIN pg_attribute a
      ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
    JOIN pg_attribute fa
      ON fa.attrelid = r.oid AND fa.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND t.relname = 'conceptos_costo'
      AND r.relname = 'cotizacion_costos'
      AND a.attname = 'cotizacion_costo_origen_id'
      AND fa.attname = 'id'
      AND array_length(c.conkey, 1) = 1
  ), 'La identidad debe apuntar por FK al renglón exacto de cotizacion_costos(id)');

  -- 2) Helper privado de aplicación de tarifa -------------------------------
  v_oid := to_regprocedure('public._embarque_aplicar_tarifa_decidida(uuid,uuid,uuid)');
  PERFORM pg_temp.assert(v_oid IS NOT NULL,
    'Falta public._embarque_aplicar_tarifa_decidida(uuid,uuid,uuid)');
  PERFORM pg_temp.assert(
    (SELECT pg_get_function_result(v_oid)) = 'integer',
    'El helper de aplicación de tarifa debe devolver integer');
  PERFORM pg_temp.assert(NOT has_function_privilege('authenticated', v_oid, 'EXECUTE'),
    'authenticated no debe ejecutar el helper privado de tarifa');
  PERFORM pg_temp.assert(has_function_privilege('service_role', v_oid, 'EXECUTE'),
    'service_role debe conservar EXECUTE sobre el helper privado de tarifa');

  -- 3) Revalidación de tarifa ----------------------------------------------
  v_oid := to_regprocedure('public.revalidar_tarifa_cotizacion(uuid)');
  PERFORM pg_temp.assert(v_oid IS NOT NULL,
    'Falta public.revalidar_tarifa_cotizacion(uuid)');
  PERFORM pg_temp.assert(
    (SELECT pg_get_function_result(v_oid)) = 'jsonb',
    'revalidar_tarifa_cotizacion debe conservar contrato jsonb');
  PERFORM pg_temp.assert(has_function_privilege('authenticated', v_oid, 'EXECUTE'),
    'authenticated debe conservar acceso a revalidar_tarifa_cotizacion');

  -- 4) Wrapper público vs core privado -------------------------------------
  v_oid := to_regprocedure('public.crear_embarque_borrador_desde_cotizacion(uuid,text,uuid,jsonb)');
  PERFORM pg_temp.assert(v_oid IS NOT NULL,
    'Falta public.crear_embarque_borrador_desde_cotizacion(uuid,text,uuid,jsonb)');
  PERFORM pg_temp.assert(has_function_privilege('authenticated', v_oid, 'EXECUTE'),
    'authenticated debe conservar acceso al wrapper de creación');

  v_oid := to_regprocedure('public.crear_embarque_borrador_core(uuid)');
  PERFORM pg_temp.assert(v_oid IS NOT NULL,
    'Falta public.crear_embarque_borrador_core(uuid)');
  PERFORM pg_temp.assert(NOT has_function_privilege('authenticated', v_oid, 'EXECUTE'),
    'El core de creación debe permanecer cerrado al cliente');
  PERFORM pg_temp.assert(has_function_privilege('service_role', v_oid, 'EXECUTE'),
    'service_role debe conservar EXECUTE sobre el core de creación');

  RAISE NOTICE 'r201_cot_remate_contract: OK';
END $$;

ROLLBACK;
