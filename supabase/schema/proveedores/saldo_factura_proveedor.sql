-- Canonical schema para public.saldo_factura_proveedor (Ola 12 · R3P-01, migración 20260823100100).
-- Saldo de una factura de proveedor en su propia moneda; NC sólo 'Aplicada'
-- (regla única R3P-08) y pagos convertidos con monto_pago_en_moneda_factura.
CREATE OR REPLACE FUNCTION public.saldo_factura_proveedor(p_factura_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_f public.proveedor_facturas;
  v_pagado numeric;
  v_nc numeric;
  v_incompleto boolean;
BEGIN
  SELECT * INTO v_f
  FROM public.proveedor_facturas
  WHERE id = p_factura_id AND deleted_at IS NULL;

  IF v_f.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, v_f.moneda::text)), 0),
         BOOL_OR(pp.moneda::text <> v_f.moneda::text AND COALESCE(pp.tipo_cambio_usd, 0) <= 0)
    INTO v_pagado, v_incompleto
  FROM public.pagos_proveedor pp
  WHERE pp.proveedor_factura_id = p_factura_id
    AND pp.deleted_at IS NULL;

  SELECT COALESCE(SUM(nc.monto), 0) INTO v_nc
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
    'flujo_incompleto', COALESCE(v_incompleto, false)
  );
END;
$function$;
