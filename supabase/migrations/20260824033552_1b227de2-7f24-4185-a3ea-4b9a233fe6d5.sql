-- ============================================================================
-- FIX2 ronda 2 · B-1 (refuerzo): el REVOKE por columna no surte efecto si
-- existe un GRANT SELECT a nivel tabla. Se revoca el SELECT de tabla a
-- `authenticated` y `anon` y se re-otorga columna por columna, excluyendo las
-- cuatro columnas internas. Se hace con SQL dinámico para no omitir columnas
-- nuevas y para que el espejo sea idempotente.
-- ============================================================================
DO $fix2$
DECLARE
  v_cols text;
  v_internas text[] := ARRAY['cerrado_snapshot','tarifa_delta_jsonb','reabierto_motivo','created_by_email'];
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'embarques'
    AND NOT (column_name = ANY (v_internas));

  EXECUTE 'REVOKE SELECT ON public.embarques FROM authenticated';
  EXECUTE 'REVOKE SELECT ON public.embarques FROM anon';
  EXECUTE format('GRANT SELECT (%s) ON public.embarques TO authenticated', v_cols);
  EXECUTE format('GRANT SELECT (%s) ON public.embarques TO anon', v_cols);
END;
$fix2$;

COMMENT ON COLUMN public.embarques.cerrado_snapshot IS
  'FIX2 B-1: interno. SELECT no otorgado a authenticated/anon; el staff lo lee por public.embarques_interno_v.';
COMMENT ON COLUMN public.embarques.tarifa_delta_jsonb IS
  'FIX2 B-1: interno. SELECT no otorgado a authenticated/anon; el staff lo lee por public.embarques_interno_v.';
COMMENT ON COLUMN public.embarques.reabierto_motivo IS
  'FIX2 B-1: interno. SELECT no otorgado a authenticated/anon; el staff lo lee por public.embarques_interno_v.';
COMMENT ON COLUMN public.embarques.created_by_email IS
  'FIX2 B-1: interno. SELECT no otorgado a authenticated/anon; el staff lo lee por public.embarques_interno_v.';