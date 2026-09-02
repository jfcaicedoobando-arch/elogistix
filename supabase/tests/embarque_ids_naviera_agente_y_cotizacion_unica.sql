-- =============================================================
-- embarque_ids_naviera_agente_y_cotizacion_unica.sql · v13.823.32
--
-- P1 (cotización → embarque):
--  1) La sobrecarga viva de `crear_embarque_completo` perdía `naviera_id` y
--     `agente_id` aunque el payload los enviaba: sólo persistía los nombres.
--     Se verifica que la definición viva escriba AMBOS UUID.
--  2) Una cotización no puede producir múltiples embarques vivos: debe existir
--     el índice único parcial `embarques_cotizacion_unica_viva`.
--  3) El alta debe validar la cotización con `_assert_cotizacion_convertible`.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/embarque_ids_naviera_agente_y_cotizacion_unica.sql
-- =============================================================

BEGIN;

DO $t$
DECLARE
  v_src text;
BEGIN
  SELECT string_agg(pg_get_functiondef(p.oid), E'\n')
    INTO v_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'crear_embarque_completo';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'REGRESIÓN: public.crear_embarque_completo no existe';
  END IF;

  IF v_src !~ 'naviera_id' THEN
    RAISE EXCEPTION 'REGRESIÓN P1: crear_embarque_completo no persiste naviera_id';
  END IF;

  IF v_src !~ 'agente_id' THEN
    RAISE EXCEPTION 'REGRESIÓN P1: crear_embarque_completo no persiste agente_id';
  END IF;

  IF v_src !~ '_assert_cotizacion_convertible' THEN
    RAISE EXCEPTION 'REGRESIÓN P1: crear_embarque_completo no valida la cotización de origen';
  END IF;
END
$t$;

DO $t$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'embarques'
      AND indexname = 'embarques_cotizacion_unica_viva'
  ) THEN
    RAISE EXCEPTION 'REGRESIÓN P1: falta el índice único embarques_cotizacion_unica_viva';
  END IF;
END
$t$;

DO $t$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_assert_cotizacion_convertible'
  ) THEN
    RAISE EXCEPTION 'REGRESIÓN P1: falta public._assert_cotizacion_convertible';
  END IF;
END
$t$;

ROLLBACK;
