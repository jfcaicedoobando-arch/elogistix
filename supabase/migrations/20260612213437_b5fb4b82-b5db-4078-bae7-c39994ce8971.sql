
-- 1) RPC: recalcular totales server-side a partir de los conceptos + overrides
CREATE OR REPLACE FUNCTION public.crear_proforma_atomica(
  p_organization_id uuid, p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text,
  p_expediente text, p_bl_master text, p_concepto_ids uuid[],
  p_subtotal_usd numeric, p_iva_usd numeric, p_total_usd numeric,
  p_subtotal_mxn numeric, p_iva_mxn numeric, p_total_mxn numeric,
  p_notas text, p_operador text, p_dias_credito integer,
  p_tasa_iva numeric, p_iva_overrides jsonb DEFAULT '{}'::jsonb
)
RETURNS proformas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_numero text;
  v_proforma public.proformas;
  v_override record;
  v_org uuid;
  v_sub_usd numeric := 0;
  v_iva_usd numeric := 0;
  v_sub_mxn numeric := 0;
  v_iva_mxn numeric := 0;
BEGIN
  IF p_concepto_ids IS NULL OR array_length(p_concepto_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar al menos un concepto';
  END IF;

  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;
  PERFORM public._assert_writer(v_org);

  -- 1) Aplicar overrides de IVA por concepto
  IF p_iva_overrides IS NOT NULL AND p_iva_overrides <> '{}'::jsonb THEN
    FOR v_override IN
      SELECT key AS concepto_id, (value)::text::boolean AS aplica
      FROM jsonb_each(p_iva_overrides)
    LOOP
      UPDATE public.conceptos_venta
      SET aplica_iva = v_override.aplica
      WHERE id = v_override.concepto_id::uuid
        AND organization_id = v_org;
    END LOOP;
  END IF;

  -- 2) Recalcular totales SERVER-SIDE (source of truth)
  SELECT
    COALESCE(SUM(CASE WHEN moneda='USD' THEN cantidad*precio_unitario ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='USD' AND aplica_iva
                      THEN cantidad*precio_unitario*COALESCE(tasa_iva_aplicada, p_tasa_iva)
                      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='MXN' THEN cantidad*precio_unitario ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='MXN'
                      THEN cantidad*precio_unitario*COALESCE(tasa_iva_aplicada, p_tasa_iva)
                      ELSE 0 END), 0)
  INTO v_sub_usd, v_iva_usd, v_sub_mxn, v_iva_mxn
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids) AND organization_id = v_org;

  -- Loguear desfases del cliente para detectar regresiones
  IF ABS(COALESCE(p_iva_usd,0) - v_iva_usd) > 0.01
     OR ABS(COALESCE(p_iva_mxn,0) - v_iva_mxn) > 0.01 THEN
    RAISE NOTICE 'crear_proforma_atomica: desfase cliente vs server. iva_usd cliente=%, server=%, iva_mxn cliente=%, server=%',
      p_iva_usd, v_iva_usd, p_iva_mxn, v_iva_mxn;
  END IF;

  v_numero := public.generar_numero_proforma(v_org);

  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    v_sub_usd, v_iva_usd, v_sub_usd + v_iva_usd,
    v_sub_mxn, v_iva_mxn, v_sub_mxn + v_iva_mxn,
    p_notas, p_operador, p_dias_credito, v_org, p_tasa_iva
  )
  RETURNING * INTO v_proforma;

  UPDATE public.conceptos_venta
  SET estado_facturacion = 'en_proforma', proforma_id = v_proforma.id
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org;

  RETURN v_proforma;
END;
$function$;

-- 2) Reparar proformas existentes no facturadas con totales desincronizados
WITH recalculo AS (
  SELECT
    p.id,
    COALESCE(SUM(CASE WHEN cv.moneda='USD' THEN cv.cantidad*cv.precio_unitario ELSE 0 END), 0) AS sub_usd,
    COALESCE(SUM(CASE WHEN cv.moneda='USD' AND cv.aplica_iva
                      THEN cv.cantidad*cv.precio_unitario*COALESCE(cv.tasa_iva_aplicada, p.tasa_iva_aplicada, 0.16)
                      ELSE 0 END), 0) AS iva_usd,
    COALESCE(SUM(CASE WHEN cv.moneda='MXN' THEN cv.cantidad*cv.precio_unitario ELSE 0 END), 0) AS sub_mxn,
    COALESCE(SUM(CASE WHEN cv.moneda='MXN'
                      THEN cv.cantidad*cv.precio_unitario*COALESCE(cv.tasa_iva_aplicada, p.tasa_iva_aplicada, 0.16)
                      ELSE 0 END), 0) AS iva_mxn
  FROM public.proformas p
  JOIN public.conceptos_venta cv ON cv.proforma_id = p.id
  WHERE COALESCE(p.estado_proforma, 'pendiente') <> 'facturada'
  GROUP BY p.id, p.tasa_iva_aplicada
)
UPDATE public.proformas p
SET subtotal_usd = r.sub_usd,
    iva_usd = r.iva_usd,
    total_usd = r.sub_usd + r.iva_usd,
    subtotal_mxn = r.sub_mxn,
    iva_mxn = r.iva_mxn,
    total_mxn = r.sub_mxn + r.iva_mxn
FROM recalculo r
WHERE p.id = r.id
  AND (ABS(p.iva_usd - r.iva_usd) > 0.01
       OR ABS(p.iva_mxn - r.iva_mxn) > 0.01
       OR ABS(p.subtotal_usd - r.sub_usd) > 0.01
       OR ABS(p.subtotal_mxn - r.sub_mxn) > 0.01);
