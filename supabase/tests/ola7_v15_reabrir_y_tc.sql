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
  seg_emb text;
  seg_com text;
  col text;
  faltantes text[] := '{}';
BEGIN
  -- ── M-1 / OLA 1 A-1 ────────────────────────────────────────────────────
  -- Guard ESTRUCTURAL contra el esquema vivo: cada columna asignada en el
  -- UPDATE de `embarques` debe existir en `embarques`, y la limpieza de la
  -- foto de comisiones (`pnl_base`, `calculo_snapshot`, `definitiva`) debe
  -- vivir en el UPDATE de `comisiones_devengadas`. Así una redefinición que
  -- vuelva a escribir `pnl_base` en `embarques` falla en CI y no en runtime
  -- con 42703.
  d := pg_get_functiondef('public.reabrir_embarque(uuid,text,text,uuid)'::regprocedure);

  seg_emb := substring(d from 'UPDATE embarques[^;]*;');
  IF seg_emb IS NULL THEN
    RAISE EXCEPTION 'M-1 REGRESION: reabrir_embarque ya no actualiza embarques';
  END IF;
  IF position('cerrado_snapshot = NULL' in seg_emb) = 0 THEN
    RAISE EXCEPTION 'M-1 REGRESION: reabrir_embarque no limpia cerrado_snapshot';
  END IF;

  FOR col IN
    SELECT DISTINCT m[1]
    FROM regexp_matches(seg_emb, '([a-z_]+)\s*=\s*', 'g') AS m
  LOOP
    IF col NOT IN ('id') AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'embarques' AND column_name = col
    ) THEN
      faltantes := faltantes || col;
    END IF;
  END LOOP;
  IF array_length(faltantes, 1) > 0 THEN
    RAISE EXCEPTION 'M-1 REGRESION: reabrir_embarque asigna columnas inexistentes en embarques: %', faltantes;
  END IF;

  seg_com := substring(d from 'UPDATE comisiones_devengadas[^;]*;');
  IF seg_com IS NULL THEN
    RAISE EXCEPTION 'M-1 REGRESION: reabrir_embarque no actualiza comisiones_devengadas';
  END IF;
  IF position('pnl_base = NULL' in seg_com) = 0
     OR position('calculo_snapshot = NULL' in seg_com) = 0 THEN
    RAISE EXCEPTION 'M-1 REGRESION: reabrir_embarque no limpia pnl_base/calculo_snapshot de comisiones';
  END IF;
  IF position('definitiva = false' in seg_com) = 0 THEN
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
