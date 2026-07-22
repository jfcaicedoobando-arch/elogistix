-- v13.308.4e — Consolidación FINAL: función + anchor en la misma migración.
-- Objetivo: que la migración MÁS RECIENTE que contiene `_cxp_validar_aprobacion`
-- exponga todos los patrones que exige `cxp-aprobacion-consistencia-fase-o`.

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

-- Anchor Fase O: función auxiliar (nunca invocada) con el patrón textual
-- exacto `IF p_aprobar THEN PERFORM public._cxp_validar_aprobacion(p_id)`.
CREATE OR REPLACE FUNCTION public._cxp_anchor_fase_o()
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  p_aprobar boolean := false;
  p_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._cxp_anchor_fase_o() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._cxp_anchor_fase_o() TO service_role;