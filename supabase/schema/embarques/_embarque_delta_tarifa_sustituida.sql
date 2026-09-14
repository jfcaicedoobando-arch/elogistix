-- Fuente canónica de public._embarque_delta_tarifa_sustituida
-- v13.823.392 · Auditoría cotización→embarque #4: el navegador enviaba como
-- `p_delta_jsonb` el resultado de `revalidar_tarifa_cotizacion` (comparación
-- contra la tarifa ORIGINAL) incluso cuando la decisión era 'sustituida' con
-- OTRA tarifa. Ese dato quedaba persistido en `embarques.tarifa_delta_jsonb` y
-- en la bitácora, auditando una economía que nunca ocurrió.
--
-- Esta función calcula el delta autoritativo EN SERVIDOR: concepto por concepto
-- (flete base + recargos) entre la tarifa original de la cotización y la tarifa
-- efectivamente elegida. Sólo lectura, acotada a la organización de la
-- cotización. Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public._embarque_delta_tarifa_sustituida(
  p_cotizacion_id uuid,
  p_tarifa_id_aplicada uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_org     uuid;
  v_origen  uuid;
  v_cambios jsonb;
BEGIN
  IF p_cotizacion_id IS NULL OR p_tarifa_id_aplicada IS NULL THEN
    RETURN jsonb_build_object('origen', 'servidor', 'decision', 'sustituida', 'cambios', '[]'::jsonb);
  END IF;

  SELECT c.organization_id, c.tarifa_id INTO v_org, v_origen
    FROM public.cotizaciones c
   WHERE c.id = p_cotizacion_id;

  WITH conceptos AS (
    SELECT t.id AS tarifa_id, 'Flete base'::text AS concepto,
           upper(btrim(t.moneda)) AS moneda, COALESCE(t.flete_base, 0) AS monto
      FROM public.costeo_tarifas t
     WHERE t.organization_id = v_org
       AND t.id IN (v_origen, p_tarifa_id_aplicada)
    UNION ALL
    SELECT r.tarifa_id, r.concepto || ' (' || r.lado || ')',
           upper(btrim(r.moneda)), COALESCE(r.monto, 0)
      FROM public.costeo_tarifa_recargos r
      JOIN public.costeo_tarifas t ON t.id = r.tarifa_id
     WHERE t.organization_id = v_org
       AND r.tarifa_id IN (v_origen, p_tarifa_id_aplicada)
       AND r.incluido_en_total
  ),
  antes AS (
    SELECT concepto, moneda, sum(monto) AS monto
      FROM conceptos WHERE tarifa_id = v_origen GROUP BY 1, 2
  ),
  ahora AS (
    SELECT concepto, moneda, sum(monto) AS monto
      FROM conceptos WHERE tarifa_id = p_tarifa_id_aplicada GROUP BY 1, 2
  ),
  union_conceptos AS (
    SELECT COALESCE(a.concepto, b.concepto) AS concepto,
           COALESCE(a.moneda, b.moneda)     AS moneda,
           a.monto AS monto_anterior,
           b.monto AS monto_actual
      FROM antes a
      FULL JOIN ahora b ON b.concepto = a.concepto AND b.moneda = a.moneda
  )
  SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'concepto',       u.concepto,
           'moneda',         u.moneda,
           'monto_anterior', COALESCE(u.monto_anterior, 0),
           'monto_actual',   u.monto_actual,
           'delta_abs',      CASE WHEN u.monto_actual IS NULL THEN NULL
                                  ELSE round(u.monto_actual - COALESCE(u.monto_anterior, 0), 2) END,
           'delta_pct',      CASE WHEN u.monto_actual IS NULL OR COALESCE(u.monto_anterior, 0) = 0 THEN NULL
                                  ELSE round((u.monto_actual - u.monto_anterior) / u.monto_anterior * 100, 2) END,
           'motivo',         CASE WHEN u.monto_actual IS NULL THEN 'eliminado' ELSE NULL END
         )) ORDER BY u.concepto), '[]'::jsonb)
    INTO v_cambios
    FROM union_conceptos u
   WHERE u.monto_actual IS DISTINCT FROM u.monto_anterior;

  RETURN jsonb_build_object(
    'origen', 'servidor',
    'decision', 'sustituida',
    'calculado_en', now(),
    'tarifa_id_original', v_origen,
    'tarifa_id_aplicada', p_tarifa_id_aplicada,
    'cambios', COALESCE(v_cambios, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._embarque_delta_tarifa_sustituida(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._embarque_delta_tarifa_sustituida(uuid, uuid) TO service_role;
