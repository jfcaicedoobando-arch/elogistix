-- Fuente canónica de public._assert_cotizacion_venta_valida
-- v13.823.357 · Auditoría YAGNI (cotizaciones→embarques) P1 #1, #3 y P2 #7:
--   #1 No se convierte una cotización sin ningún renglón de venta positivo.
--   #3 Invariancia costo→venta: un `precio_venta` positivo capturado en el
--      paso 2 debe estar reflejado en `conceptos_venta` de la misma moneda.
--   #7 Sólo MXN y USD están soportados; una moneda desconocida ya no se
--      convierte en silencio a MXN.
-- B18 (v13.823.379): las cotizaciones informativas (tarifarios) NO se convierten:
--   antes salían por RETURN temprano y una llamada directa a la RPC podía crear
--   el embarque; ahora fallan con LC_COT_INFORMATIVA.
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public._assert_cotizacion_venta_valida(p_cotizacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_folio      text;
  v_tipo_doc   text;
  v_ventas     jsonb;
  v_positiva   boolean;
  v_moneda_mala text;
  v_sin_reflejo text;
  v_mal_formadas text;
BEGIN
  IF p_cotizacion_id IS NULL THEN RETURN; END IF;

  SELECT folio, COALESCE(tipo_documento, 'transaccional'),
         CASE WHEN jsonb_typeof(COALESCE(conceptos_venta, '[]'::jsonb)) = 'array'
              THEN COALESCE(conceptos_venta, '[]'::jsonb) ELSE '[]'::jsonb END
    INTO v_folio, v_tipo_doc, v_ventas
    FROM public.cotizaciones
   WHERE id = p_cotizacion_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- B18: las informativas (tarifarios) son documentos de referencia; no pueden
  -- convertirse en embarque. Este candado vive en el helper canónico que llaman
  -- crear_embarque_borrador_core y _assert_cotizacion_convertible, así que
  -- cubre también las llamadas directas a las RPC. No afecta su consulta.
  IF v_tipo_doc = 'informativa' THEN
    RAISE EXCEPTION 'LC_COT_INFORMATIVA: la cotización % es informativa (tarifario) y no puede convertirse en embarque', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  -- v13.823.370 (P1-1) — Candado de costos canónico y fail-closed. La ruta de
  -- revalidación (CrearEmbarqueConRevalidacion → crear_embarque_borrador_core)
  -- no pasaba por el candado de UI, así que una cotización Aceptada con venta
  -- pero SIN desglose de costos podía crear el borrador. Al vivir aquí queda
  -- cubierta TODA decisión de tarifa (sin_cambios, mantenida_por_operaciones,
  -- refrescada, sustituida, reaprobada_ventas) y también las llamadas directas
  -- a la RPC. Las informativas ya salieron arriba.
  IF NOT EXISTS (
    SELECT 1 FROM public.cotizacion_costos cc
     WHERE cc.cotizacion_id = p_cotizacion_id
       AND cc.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_COT_SIN_COSTOS: la cotización % no tiene costos cargados; captura el desglose de costos en la cotización antes de crear el embarque', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  -- v13.823.392 · Auditoría cotización→embarque #5: antes sólo se exigía que
  -- EXISTIERA una línea positiva. Una segunda línea legacy con cantidad='dos'
  -- pasaba este candado y reventaba después en
  -- `_crear_embarque_replicar_conceptos` con "invalid input syntax for type
  -- numeric" (error genérico de PostgreSQL, no una regla de negocio). Ahora se
  -- validan TODAS las líneas con descripción y se responde con la descripción
  -- de la fila culpable, sin crear embarque parcial.
  SELECT string_agg(DISTINCT c.desc_txt, '; ')
    INTO v_mal_formadas
    FROM (
      SELECT btrim(x->>'descripcion')       AS desc_txt,
             btrim(COALESCE(x->>'cantidad', ''))            AS cant,
             btrim(COALESCE(x->>'precio_unitario', ''))     AS pu,
             btrim(COALESCE(x->>'total', ''))               AS tot,
             btrim(COALESCE(x->>'tasa_iva_aplicada', ''))   AS tasa
        FROM jsonb_array_elements(v_ventas) x
       WHERE COALESCE(btrim(x->>'descripcion'), '') <> ''
    ) c
   WHERE (c.cant <> '' AND c.cant !~ '^-?[0-9]+(\.[0-9]+)?$')
      OR (c.pu   <> '' AND c.pu   !~ '^-?[0-9]+(\.[0-9]+)?$')
      OR (c.tot  <> '' AND c.tot  !~ '^-?[0-9]+(\.[0-9]+)?$')
      OR (c.tasa <> '' AND c.tasa !~ '^-?[0-9]+(\.[0-9]+)?$');

  IF v_mal_formadas IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_VENTA_IMPORTE_INVALIDO: el concepto de venta "%" tiene cantidad, precio, total o tasa de IVA con un valor que no es numérico; corrígelo en la cotización antes de crear el embarque', v_mal_formadas
      USING ERRCODE = 'P0001';
  END IF;

  WITH v AS (
    SELECT upper(btrim(COALESCE(c->>'moneda', 'MXN'))) AS moneda,
           CASE WHEN COALESCE(NULLIF(c->>'cantidad', ''), '1') ~ '^-?[0-9]+(\.[0-9]+)?$'
                THEN (c->>'cantidad')::numeric ELSE 0 END AS cant,
           CASE WHEN COALESCE(NULLIF(c->>'precio_unitario', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                THEN (c->>'precio_unitario')::numeric ELSE 0 END AS pu
      FROM jsonb_array_elements(v_ventas) c
     WHERE COALESCE(btrim(c->>'descripcion'), '') <> ''
  )
  SELECT EXISTS (SELECT 1 FROM v WHERE cant > 0 AND pu > 0),
         (SELECT string_agg(DISTINCT moneda, ', ') FROM v WHERE moneda NOT IN ('MXN', 'USD'))
    INTO v_positiva, v_moneda_mala;

  IF v_moneda_mala IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_MONEDA_NO_SOPORTADA: la cotización % tiene conceptos de venta en una moneda no soportada (%); sólo MXN y USD están habilitados', COALESCE(v_folio, p_cotizacion_id::text), v_moneda_mala
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_positiva, false) THEN
    RAISE EXCEPTION 'LC_COT_SIN_VENTA: la cotización % no tiene ningún concepto de venta con cantidad y precio mayores a cero', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  SELECT string_agg(DISTINCT c.m, ', ')
    INTO v_sin_reflejo
    FROM (
      SELECT upper(btrim(cc.moneda)) AS m
        FROM public.cotizacion_costos cc
       WHERE cc.cotizacion_id = p_cotizacion_id
         AND cc.deleted_at IS NULL
         AND COALESCE(cc.precio_venta, 0) > 0
    ) c
   WHERE NOT EXISTS (
     SELECT 1
       FROM jsonb_array_elements(v_ventas) x
      WHERE upper(btrim(COALESCE(x->>'moneda', 'MXN'))) = c.m
        AND COALESCE(btrim(x->>'descripcion'), '') <> ''
        AND CASE WHEN COALESCE(NULLIF(x->>'cantidad', ''), '1') ~ '^-?[0-9]+(\.[0-9]+)?$'
                 THEN (x->>'cantidad')::numeric ELSE 0 END > 0
        AND CASE WHEN COALESCE(NULLIF(x->>'precio_unitario', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                 THEN (x->>'precio_unitario')::numeric ELSE 0 END > 0
   );

  IF v_sin_reflejo IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_VENTA_NO_REFLEJADA: la cotización % tiene precio de venta capturado en % que no llegó a los conceptos de venta; vuelve a guardar el paso 3 antes de convertir', COALESCE(v_folio, p_cotizacion_id::text), v_sin_reflejo
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_cotizacion_venta_valida(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_cotizacion_venta_valida(uuid) TO service_role;
