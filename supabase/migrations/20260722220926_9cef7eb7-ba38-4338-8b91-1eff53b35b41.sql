-- v13.308.4 — Re-anclaje GRANT/REVOKE + search_path en funciones CxP.
-- Guardrails cxp-multimoneda-fase-l y cxp-aprobacion-consistencia-fase-o
-- exigen ver estos bloques en la migración más reciente que redefine
-- cada función. R4 (v13.308.0 / v13.307.21) los había omitido.

-- (1) convertir_monto_pago_a_factura
CREATE OR REPLACE FUNCTION public.convertir_monto_pago_a_factura(
  p_monto numeric, p_moneda_pago moneda, p_tc_pago numeric,
  p_moneda_fact moneda, p_tc_fact numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE v_tc numeric;
BEGIN
  IF p_monto IS NULL THEN RETURN NULL; END IF;
  IF p_moneda_pago = p_moneda_fact THEN RETURN p_monto; END IF;

  IF (p_moneda_pago = 'MXN' AND p_moneda_fact = 'USD')
     OR (p_moneda_pago = 'USD' AND p_moneda_fact = 'MXN') THEN
    v_tc := NULLIF(p_tc_pago, 0);
    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: capture el tipo de cambio del pago (%->%)',
        p_moneda_pago, p_moneda_fact
        USING ERRCODE = '22023';
    END IF;
    IF p_moneda_pago = 'MXN' THEN RETURN round(p_monto / v_tc, 4);
    ELSE                          RETURN round(p_monto * v_tc, 4);
    END IF;
  END IF;

  RAISE EXCEPTION 'LC_PAGO_CRUCE_NO_SOPORTADO: conversion % -> % no soportada.',
    p_moneda_pago, p_moneda_fact
    USING ERRCODE = '22023';
END;
$function$;

REVOKE ALL ON FUNCTION public.convertir_monto_pago_a_factura(numeric, moneda, numeric, moneda, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convertir_monto_pago_a_factura(numeric, moneda, numeric, moneda, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.convertir_monto_pago_a_factura(numeric, moneda, numeric, moneda, numeric) TO authenticated, service_role;

-- (2) _cxp_validar_aprobacion
CREATE OR REPLACE FUNCTION public._cxp_validar_aprobacion(p_factura_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_conceptos_count integer;
  v_suma_conceptos numeric(18,4);
  v_tiene_xml_lineas boolean;
  v_diferencia numeric(18,4);
  v_emb_estado text;
  v_emb_org uuid;
BEGIN
  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_FACTURA_NO_EXISTE: La factura no existe.';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.proveedor_facturas_conceptos
    WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NULL
  ) INTO v_tiene_xml_lineas;

  IF v_tiene_xml_lineas THEN
    SELECT COUNT(*), COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id
        AND concepto_costo_id IS NULL;
  ELSE
    SELECT COUNT(*), COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id;
  END IF;

  IF v_conceptos_count = 0 THEN
    RAISE EXCEPTION 'LC_CXP_SIN_CONCEPTOS: Captura los conceptos de la factura antes de aprobar.';
  END IF;

  v_diferencia := ABS(COALESCE(v_row.subtotal,0) - v_suma_conceptos);
  IF v_diferencia > 0.01 THEN
    RAISE EXCEPTION 'LC_CXP_DESCUADRE: Los conceptos (%.2f) no cuadran con el subtotal (%.2f) de la factura. Diferencia: %.2f',
      v_suma_conceptos, COALESCE(v_row.subtotal,0), v_diferencia;
  END IF;

  IF v_row.embarque_id IS NOT NULL THEN
    SELECT estado, organization_id INTO v_emb_estado, v_emb_org
      FROM public.embarques WHERE id = v_row.embarque_id;
    IF v_emb_estado IS NULL THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_NO_EXISTE: El embarque asociado no existe.';
    END IF;
    IF v_emb_estado = 'Cancelado' THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_CANCELADO: El embarque asociado está cancelado.';
    END IF;
    IF v_emb_org IS DISTINCT FROM v_row.organization_id THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_ORG_MISMATCH: El embarque pertenece a otra organización.';
    END IF;
  END IF;

  IF v_row.uuid_fiscal IS NOT NULL AND COALESCE(v_row.uuid_verificado,false) = false THEN
    RAISE EXCEPTION 'LC_CXP_UUID_NO_VERIFICADO: Verifica el UUID en el SAT antes de aprobar.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._cxp_validar_aprobacion(uuid) TO authenticated, service_role;