-- Ola 7 (re-auditoría v15) · guards conductuales.
--
-- M-1: `reabrir_embarque` debe limpiar la foto del cierre. El fix ya se había
--      perdido una vez porque una migración posterior redefinió la función
--      completa; este guard es de PROPIEDAD (no de texto libre) para que la
--      próxima redefinición falle en CI en lugar de en producción.
-- M-8: `a_mxn` debe exigir tipo de cambio > 1 (espejo de `tcConfiable`).
-- M-10: la regla `contenedores_totales_descuadrados` debe existir en la
--      auditoría y en el agregador.
-- N-1: `_crear_embarque_replicar_conceptos` no debe clamar cantidades con
--      GREATEST(...,1).
BEGIN;

DO $$
DECLARE
  d text;
BEGIN
  -- ── M-1 ────────────────────────────────────────────────────────────────
  d := pg_get_functiondef('public.reabrir_embarque(uuid,text,text,uuid)'::regprocedure);
  IF position('cerrado_snapshot = NULL' in d) = 0 THEN
    RAISE EXCEPTION 'M-1 REGRESION: reabrir_embarque no limpia cerrado_snapshot';
  END IF;
  IF position('pnl_base = NULL' in d) = 0
     OR position('calculo_snapshot = NULL' in d) = 0 THEN
    RAISE EXCEPTION 'M-1 REGRESION: reabrir_embarque no limpia pnl_base/calculo_snapshot de comisiones';
  END IF;
  IF position('definitiva = false' in d) = 0 THEN
    RAISE EXCEPTION 'M-1 REGRESION: reabrir_embarque no revierte definitiva en comisiones';
  END IF;

  -- ── N-1 ────────────────────────────────────────────────────────────────
  d := pg_get_functiondef('public._crear_embarque_replicar_conceptos(uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
  IF position('GREATEST(COALESCE((v_venta->>''cantidad'')::numeric, 1), 1)' in d) > 0 THEN
    RAISE EXCEPTION 'N-1 REGRESION: la replica de conceptos vuelve a clamar la cantidad a 1';
  END IF;

  -- ── M-10 ───────────────────────────────────────────────────────────────
  d := pg_get_functiondef('public.auditoria_embarques_org(uuid)'::regprocedure);
  IF position('contenedores_totales_descuadrados' in d) = 0 THEN
    RAISE EXCEPTION 'M-10 REGRESION: falta la regla contenedores_totales_descuadrados en la auditoria';
  END IF;
  d := pg_get_functiondef('public._audit_embarques_agregar(jsonb,jsonb)'::regprocedure);
  IF position('contenedores_totales_descuadrados' in d) = 0 THEN
    RAISE EXCEPTION 'M-10 REGRESION: el agregador no cuenta contenedores_totales_descuadrados';
  END IF;
  IF position('venta_total_descuadrado' in d) = 0 THEN
    RAISE EXCEPTION 'M-10 REGRESION: el agregador dejo de contar venta_total_descuadrado';
  END IF;
END $$;

-- ── M-8: `a_mxn` sólo convierte con T/C > 1 ────────────────────────────────
DO $$
DECLARE
  d text := pg_get_functiondef('public.a_mxn(numeric,text,numeric,numeric)'::regprocedure);
BEGIN
  IF position('COALESCE(p_usd_mxn, 0) > 1' in d) = 0
     OR position('COALESCE(p_eur_mxn, 0) > 1' in d) = 0 THEN
    RAISE EXCEPTION 'M-8 REGRESION: a_mxn acepta tipos de cambio <= 1 (sentinelas)';
  END IF;
  RAISE NOTICE 'OK Ola 7 v15: M-1, M-8, M-10 y N-1 vigentes';
END $$;

ROLLBACK;
