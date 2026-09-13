-- =============================================================
-- comision_pnl_base_cierre.sql · B-4
--
-- Regresión de orden en `cerrar_embarque`: la foto financiera de las
-- comisiones (`definitiva`, `pnl_base`, `calculo_snapshot`) debe escribirse
-- DESPUÉS del recálculo de comisiones (`calcular_comision_pago`), no antes.
-- Si el recálculo corriera después, las comisiones quedarían con la foto de
-- un P&L previo (desfase B-4).
--
-- Se verifica sobre el código instalado de la función (pg_get_functiondef),
-- igual que `ola7_v15_reabrir_y_tc.sql`: el cierre real exige checklist,
-- saldos en cero y documentos, condiciones que no aportan a este invariante.
--
-- Verifica:
--   1) el recálculo `calcular_comision_pago` aparece antes del UPDATE de
--      comisiones_devengadas que fija la foto;
--   2) ese UPDATE escribe `definitiva`, `pnl_base` y `calculo_snapshot`;
--   3) `pnl_base`/`calculo_snapshot` provienen del P&L calculado en el cierre
--      (v_pnl), no de una relectura posterior;
--   4) el UPDATE está acotado al embarque que se cierra.
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/comision_pnl_base_cierre.sql
-- =============================================================

BEGIN;

DO $b4$
DECLARE
  d text := pg_get_functiondef('public.cerrar_embarque(uuid)'::regprocedure);
  seg_com text;
  pos_recalc integer;
  pos_update integer;
BEGIN
  seg_com := substring(d from 'UPDATE comisiones_devengadas[^;]*;');
  IF seg_com IS NULL THEN
    RAISE EXCEPTION 'B-4 REGRESION: cerrar_embarque ya no fija la foto de comisiones';
  END IF;

  pos_recalc := position('calcular_comision_pago' in d);
  pos_update := position(seg_com in d);
  IF pos_recalc = 0 THEN
    RAISE EXCEPTION 'B-4 REGRESION: cerrar_embarque ya no recalcula comisiones';
  END IF;
  IF pos_recalc > pos_update THEN
    RAISE EXCEPTION 'B-4 REGRESION: el recálculo de comisiones corre DESPUÉS de fijar pnl_base (desfase)';
  END IF;

  IF position('definitiva = true' in seg_com) = 0
     OR position('pnl_base' in seg_com) = 0
     OR position('calculo_snapshot' in seg_com) = 0 THEN
    RAISE EXCEPTION 'B-4 REGRESION: la foto de comisiones no fija definitiva/pnl_base/calculo_snapshot';
  END IF;

  IF position('v_pnl' in seg_com) = 0 THEN
    RAISE EXCEPTION 'B-4 REGRESION: pnl_base/calculo_snapshot ya no provienen del P&L del cierre';
  END IF;

  IF position('embarque_id = p_embarque_id' in seg_com) = 0 THEN
    RAISE EXCEPTION 'B-4 REGRESION: la foto de comisiones no está acotada al embarque que se cierra';
  END IF;

  RAISE NOTICE 'B-4 OK: recálculo antes de la foto; pnl_base/calculo_snapshot del P&L del cierre y acotados al embarque';
END;
$b4$;

ROLLBACK;
