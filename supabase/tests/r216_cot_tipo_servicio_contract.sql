-- =============================================================
-- r216_cot_tipo_servicio_contract.sql · SMOKE-02 (R216-COT-01)
--
-- Contrato: la conversión directa cotización → embarque
-- (`public.crear_embarque_borrador_core`) siembra `embarques.tipo_servicio`
-- con FCL/LCL desde `cotizaciones.tipo_embarque` (respaldo `tipo_carga`),
-- misma fuente de verdad que la hidratación del wizard, y NO altera la
-- replicación de conceptos ni la bitácora/notificación existentes.
--
-- Formato: DO $$ + pg_temp.assert (convención de scripts/ci/run-guards.sh).
-- Sólo lectura del catálogo: no inserta datos ni toca históricos.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/r216_cot_tipo_servicio_contract.sql
-- =============================================================

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert(p_cond boolean, p_msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(p_cond, false) THEN
    RAISE EXCEPTION 'ASSERT FALLÓ: %', p_msg;
  END IF;
END;
$$;

DO $$
DECLARE v_src text;
BEGIN
  SELECT prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'crear_embarque_borrador_core';

  PERFORM pg_temp.assert(v_src IS NOT NULL, 'crear_embarque_borrador_core debe existir');

  -- Fuente de verdad idéntica a la del wizard.
  PERFORM pg_temp.assert(position('v_cot.tipo_embarque' in v_src) > 0,
    'debe leer cotizaciones.tipo_embarque para el servicio marítimo');

  -- Regresión FCL y LCL: ambos valores se aceptan y cualquier otro queda NULL.
  PERFORM pg_temp.assert(position('''FCL''' in v_src) > 0, 'debe sembrar FCL');
  PERFORM pg_temp.assert(position('''LCL''' in v_src) > 0, 'debe sembrar LCL');
  PERFORM pg_temp.assert(position('tipo_servicio_maritimo' in v_src) > 0,
    'debe insertar tipo_servicio con el enum tipo_servicio_maritimo');
  PERFORM pg_temp.assert(position('v_tipo_servicio := NULL' in v_src) > 0,
    'valores distintos de FCL/LCL o modos no marítimos deben quedar sin servicio');

  -- Lo que ya funcionaba se preserva tal cual (costo/origen, bitácora, aviso).
  PERFORM pg_temp.assert(position('_crear_embarque_replicar_conceptos' in v_src) > 0,
    'debe conservar la replicación de conceptos (costo/origen)');
  PERFORM pg_temp.assert(position('Borrador de embarque creado' in v_src) > 0,
    'debe conservar la bitácora de creación');
  PERFORM pg_temp.assert(position('notificaciones_internas' in v_src) > 0,
    'debe conservar la notificación interna');
END;
$$;

-- Privilegios: el core sigue siendo privado (sólo service_role).
DO $$
BEGIN
  PERFORM pg_temp.assert(
    NOT has_function_privilege('authenticated',
      'public.crear_embarque_borrador_core(uuid)', 'EXECUTE'),
    'authenticated NO debe poder ejecutar crear_embarque_borrador_core');
  PERFORM pg_temp.assert(
    has_function_privilege('service_role',
      'public.crear_embarque_borrador_core(uuid)', 'EXECUTE'),
    'service_role debe poder ejecutar crear_embarque_borrador_core');
END;
$$;

ROLLBACK;
