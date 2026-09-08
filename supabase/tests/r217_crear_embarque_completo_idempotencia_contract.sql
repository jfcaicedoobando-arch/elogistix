-- =============================================================
-- r217_crear_embarque_completo_idempotencia_contract.sql
--
-- Contrato: en `public.crear_embarque_completo` el claim de idempotencia
-- (`idempotency_claim`) debe ocurrir ANTES de `_assert_cotizacion_convertible`,
-- para que un reintento con el mismo p_request_id devuelva la respuesta
-- cacheada en vez de fallar con LC_COT_YA_TIENE_EMBARQUE.
--
-- Formato: BEGIN + DO $$ + pg_temp.assert (convención de scripts/ci/run-guards.sh).
-- Sólo lectura del catálogo: no inserta datos ni simula base real.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/r217_crear_embarque_completo_idempotencia_contract.sql
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
DECLARE
  v_src text;
  v_pos_claim int;
  v_pos_convertible int;
  v_pos_medidas int;
  v_pos_writer int;
  v_pos_relaciones int;
BEGIN
  SELECT prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'crear_embarque_completo';

  PERFORM pg_temp.assert(v_src IS NOT NULL, 'crear_embarque_completo debe existir');

  v_pos_claim       := position('idempotency_claim' in v_src);
  v_pos_convertible := position('_assert_cotizacion_convertible' in v_src);
  v_pos_medidas     := position('_assert_medidas_embarque' in v_src);
  v_pos_writer      := position('_assert_writer' in v_src);
  v_pos_relaciones  := position('_assert_relaciones_embarque' in v_src);

  PERFORM pg_temp.assert(v_pos_claim > 0, 'debe reclamar idempotencia con idempotency_claim');
  PERFORM pg_temp.assert(v_pos_convertible > 0, 'debe validar convertibilidad de la cotización');

  -- Invariante del bug R217.
  PERFORM pg_temp.assert(v_pos_claim < v_pos_convertible,
    'idempotency_claim debe preceder a _assert_cotizacion_convertible');

  -- Las validaciones puras siguen antes del claim.
  PERFORM pg_temp.assert(v_pos_medidas > 0 AND v_pos_medidas < v_pos_claim,
    '_assert_medidas_embarque debe seguir antes del claim');
  PERFORM pg_temp.assert(v_pos_writer > 0 AND v_pos_writer < v_pos_claim,
    '_assert_writer debe seguir antes del claim');
  PERFORM pg_temp.assert(v_pos_relaciones > 0 AND v_pos_relaciones < v_pos_claim,
    '_assert_relaciones_embarque debe seguir antes del claim');

  -- El almacenamiento de la respuesta idempotente se conserva.
  PERFORM pg_temp.assert(position('idempotency_store' in v_src) > 0,
    'debe conservar idempotency_store al final');
END;
$$;

ROLLBACK;
