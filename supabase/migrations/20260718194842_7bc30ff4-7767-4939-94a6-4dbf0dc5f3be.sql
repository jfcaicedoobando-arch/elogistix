-- v13.301.69 · Fase A backfill real (los 192 huérfanos detectados).
DO $$
DECLARE
  v_rows int;
BEGIN
  PERFORM set_config('app.bypass_cierre', 'on', true);

  WITH src_to_target AS (
    SELECT src.id AS src_id, tgt.id AS tgt_id
    FROM public.proformas src
    JOIN public.proformas tgt
      ON src.id = ANY(tgt.proformas_origen)
     AND tgt.es_consolidada = true
     AND tgt.deleted_at IS NULL
    WHERE src.estado_revision = 'consolidada'
      AND src.deleted_at IS NULL
  ),
  updated AS (
    UPDATE public.conceptos_venta cv
       SET proforma_id = s.tgt_id
      FROM src_to_target s
     WHERE cv.proforma_id = s.src_id
       AND cv.deleted_at IS NULL
    RETURNING cv.id
  )
  SELECT count(*) INTO v_rows FROM updated;

  PERFORM set_config('app.bypass_cierre', 'off', true);
  RAISE NOTICE 'v13.301.69 backfill: repunted % conceptos_venta a proformas consolidadas', v_rows;
END;
$$;