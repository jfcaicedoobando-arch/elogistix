-- =============================================================
-- tolerancia_conciliacion_por_moneda.sql · Lote MNY (P1.3)
--
-- La tolerancia de importe al conciliar depende de la MONEDA:
--   MXN → 1.00 · USD/EUR → 0.05 · moneda desconocida → 0 (exacta).
-- El disparador `assert_movimiento_pago_consistente` es la defensa final y usa
-- la misma regla que el frontend (`toleranciaMonto`).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/tolerancia_conciliacion_por_moneda.sql
-- =============================================================

BEGIN;

DO $t$
BEGIN
  IF public.tolerancia_conciliacion_moneda('MXN') <> 1.00 THEN
    RAISE EXCEPTION 'FALLO: MXN debe tolerar 1.00, obtuvo %', public.tolerancia_conciliacion_moneda('MXN');
  END IF;

  IF public.tolerancia_conciliacion_moneda('USD') <> 0.05 THEN
    RAISE EXCEPTION 'FALLO: USD debe tolerar 0.05, obtuvo %', public.tolerancia_conciliacion_moneda('USD');
  END IF;

  IF public.tolerancia_conciliacion_moneda('eur') <> 0.05 THEN
    RAISE EXCEPTION 'FALLO: EUR (minúsculas) debe tolerar 0.05, obtuvo %', public.tolerancia_conciliacion_moneda('eur');
  END IF;

  -- Fail-closed: moneda desconocida o ausente ⇒ coincidencia exacta.
  IF public.tolerancia_conciliacion_moneda('JPY') <> 0 THEN
    RAISE EXCEPTION 'FALLO: una moneda desconocida debe exigir coincidencia exacta';
  END IF;
  IF public.tolerancia_conciliacion_moneda(NULL) <> 0 THEN
    RAISE EXCEPTION 'FALLO: sin moneda debe exigir coincidencia exacta';
  END IF;

  RAISE NOTICE 'OK · tolerancia por moneda (MXN 1.00, USD/EUR 0.05, desconocida 0)';
END;
$t$;

-- El candado usa la regla por moneda y ya no la constante en pesos.
DO $t$
DECLARE
  v_def text := pg_get_functiondef('public.assert_movimiento_pago_consistente()'::regprocedure);
BEGIN
  IF v_def NOT LIKE '%tolerancia_conciliacion_moneda%' THEN
    RAISE EXCEPTION 'FALLO: el disparador no usa tolerancia_conciliacion_moneda';
  END IF;
  IF v_def LIKE '%c_tol constant numeric := 1.00%' THEN
    RAISE EXCEPTION 'FALLO: el disparador conserva la tolerancia fija de 1.00 para toda moneda';
  END IF;
  RAISE NOTICE 'OK · disparador alineado a la tolerancia por moneda';
END;
$t$;

ROLLBACK;
