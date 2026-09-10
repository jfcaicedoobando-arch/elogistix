CREATE OR REPLACE FUNCTION public.crear_ajustes_factura_proveedor_rpc(p_factura_id uuid, p_ajustes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fact public.proveedor_facturas%ROWTYPE;
  v_count integer := 0;
  v_previos uuid[];
BEGIN
  SELECT * INTO v_fact
  FROM public.proveedor_facturas
  WHERE id = p_factura_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_fact.id IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROVEEDOR_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_fact.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  -- N6: todo embarque_id del payload debe ser un embarque vigente de la
  -- MISMA organización que la factura.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_ajustes, '[]'::jsonb)) AS a
    WHERE NULLIF(btrim(COALESCE(a->>'embarque_id', '')), '') IS NOT NULL
      AND abs(COALESCE((a->>'monto')::numeric, 0)) > 0.01
      AND NOT EXISTS (
        SELECT 1
        FROM public.embarques e
        WHERE e.id = (a->>'embarque_id')::uuid
          AND e.organization_id = v_fact.organization_id
          AND e.deleted_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'LC_EMBARQUE_AJENO: todo ajuste debe referenciar un embarque vigente de la misma organización que la factura'
      USING ERRCODE = '42501';
  END IF;

  -- v13.823.285 · candado de magnitud: un ajuste nace de la diferencia entre el
  -- costo devengado y la MISMA factura, así que nunca puede superar el total de
  -- la factura. Cuando la base congelada quedó en otra moneda (p. ej. el costo
  -- convertido a MXN contra una factura en USD) el delta era un "ajuste
  -- fantasma" que inflaba la utilidad del embarque (ELIMP00368: -546,777.68 USD
  -- sobre una factura de 34,400 USD). Se rechaza en el servidor para que ni una
  -- versión vieja del front pueda volver a insertarlo.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_ajustes, '[]'::jsonb)) AS a
    WHERE abs(COALESCE((a->>'monto')::numeric, 0)) > COALESCE(v_fact.total, 0) + 0.01
  ) THEN
    RAISE EXCEPTION 'LC_AJUSTE_DESPROPORCIONADO: el ajuste no puede exceder el total de la factura (%). Revisa la moneda del costo vinculado.', v_fact.total
      USING ERRCODE = '22003';
  END IF;

  -- Ola 5 · RG4-3: capturar ANTES de cualquier DELETE los ids de todos los
  -- conceptos de ajuste de esta factura (vivos o ya soft-borrados).
  SELECT COALESCE(array_agg(pfc.concepto_costo_id), '{}'::uuid[])
    INTO v_previos
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
   WHERE pfc.proveedor_factura_id = p_factura_id
     AND cc.origen = 'ajuste_factura_proveedor';

  -- Idempotencia (paso 1): soft-delete de los ajustes previos vivos.
  UPDATE public.conceptos_costo cc
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE cc.deleted_at IS NULL
     AND cc.id = ANY (v_previos);

  -- Idempotencia (paso 2): borrar los puentes de esos mismos ids.
  DELETE FROM public.proveedor_facturas_conceptos pfc
   WHERE pfc.proveedor_factura_id = p_factura_id
     AND pfc.concepto_costo_id = ANY (v_previos);

  -- Conceptos de ajuste + puentes, atómicos.
  WITH nuevos AS (
    INSERT INTO public.conceptos_costo (
      embarque_id, organization_id, proveedor_id, proveedor_nombre,
      concepto, monto, moneda, origen,
      estado_liquidacion, fecha_pago, referencia_pago
    )
    SELECT
      (a->>'embarque_id')::uuid,
      v_fact.organization_id,
      v_fact.proveedor_id,
      v_fact.proveedor_nombre,
      'Ajuste factura ' || COALESCE(v_fact.folio_proveedor, '') || ': ' || COALESCE(a->>'descripcion', ''),
      (a->>'monto')::numeric,
      v_fact.moneda,
      'ajuste_factura_proveedor',
      'Pagado'::estado_liquidacion,
      v_fact.fecha_emision,
      v_fact.folio_proveedor
    FROM jsonb_array_elements(COALESCE(p_ajustes, '[]'::jsonb)) AS a
    WHERE NULLIF(btrim(COALESCE(a->>'embarque_id', '')), '') IS NOT NULL
      AND abs(COALESCE((a->>'monto')::numeric, 0)) > 0.01
    RETURNING id, concepto, monto
  ),
  puentes AS (
    INSERT INTO public.proveedor_facturas_conceptos (
      proveedor_factura_id, organization_id, concepto_costo_id,
      descripcion, cantidad, monto
    )
    SELECT p_factura_id, v_fact.organization_id, n.id, n.concepto, 1, n.monto
    FROM nuevos n
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM puentes;

  RETURN jsonb_build_object('ajustes_creados', v_count, 'folio', v_fact.folio_proveedor);
END;
$function$;