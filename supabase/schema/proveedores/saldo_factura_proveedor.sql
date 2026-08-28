-- Canonical schema para public.saldo_factura_proveedor (Ola 12 · R3P-01, migración 20260823100100;
-- re-emitida con org guard en Ola 13 · Sprint 07 / R4BD-02, migración 20260824070000).
-- Saldo de una factura de proveedor en su propia moneda; NC sólo 'Aplicada'
-- y pagos convertidos con monto_pago_en_moneda_factura.
-- Org guard: 42501 'LC_ORG_SIN_CONTEXTO' sin contexto; la factura debe
-- pertenecer a la organización activa y no estar cancelada (NULL en otro caso,
-- igual que inexistente/eliminada/ajena → no es oráculo de existencia).
CREATE OR REPLACE FUNCTION public.saldo_factura_proveedor(p_factura_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_f public.proveedor_facturas;
  v_pagado numeric;
  v_nc numeric;
  v_incompleto boolean;
  v_nc_incompleto boolean;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_f
  FROM public.proveedor_facturas
  WHERE id = p_factura_id
    AND deleted_at IS NULL
    AND organization_id = v_oid
    AND estado <> 'Cancelada';

  IF v_f.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, v_f.moneda::text)), 0),
         BOOL_OR(pp.moneda::text <> v_f.moneda::text AND COALESCE(pp.tipo_cambio_usd, 0) <= 0)
    INTO v_pagado, v_incompleto
  FROM public.pagos_proveedor pp
  WHERE pp.proveedor_factura_id = p_factura_id
    AND pp.deleted_at IS NULL;

  -- Ola 17 · H8-B: la NC se valúa en la moneda de la factura con su TC DOF.
  SELECT COALESCE(SUM(public.monto_pago_en_moneda_factura(nc.monto, nc.moneda::text, nc.tipo_cambio, v_f.moneda::text)), 0),
         BOOL_OR(nc.moneda::text <> v_f.moneda::text AND COALESCE(nc.tipo_cambio, 0) <= 0)
    INTO v_nc, v_nc_incompleto
  FROM public.proveedor_notas_credito nc
  WHERE nc.proveedor_factura_id = p_factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado = 'Aplicada';

  RETURN jsonb_build_object(
    'factura_id', p_factura_id,
    'moneda', v_f.moneda::text,
    'total', COALESCE(v_f.total, 0),
    'pagado', ROUND(v_pagado, 2),
    'nc_aplicada', ROUND(v_nc, 2),
    'saldo', ROUND(GREATEST(COALESCE(v_f.total, 0) - v_pagado - v_nc, 0), 2),
    'flujo_incompleto', COALESCE(v_incompleto, false) OR COALESCE(v_nc_incompleto, false)
  );
END;
$function$;
