CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_estado estado_factura; v_org uuid;
  v_caller_org uuid; v_uid uuid; v_pagos numeric; v_ncs numeric;
  v_moneda text; v_tc numeric; v_cliente uuid;
BEGIN
  SELECT total, estado, organization_id, moneda::text, tipo_cambio, cliente_id
    INTO v_total, v_estado, v_org, v_moneda, v_tc, v_cliente
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      -- Portal: el usuario cliente sí puede consultar el saldo de SU factura.
      IF v_cliente IS NULL
         OR v_cliente NOT IN (SELECT public.current_user_client_ids()) THEN
        RETURN 0;
      END IF;
    END IF;
  END IF;

  -- BUG-2026-08-25: 'Pagada' también es terminal (facturas legacy sin pagos
  -- capturados generaban adeudo fantasma en el estado de cuenta).
  -- v13.823.145: 'Borrador' NO es terminal — una factura sin timbrar debe
  -- reportar saldo por cobrar (antes mostraba "cobrado = total" sin pagos).
  IF v_estado IN ('Cancelada', 'Sustituida', 'Pagada') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  -- BUG-04 (auditoría 2026-08-18): misma conversión que `cartera_pendiente`.
  SELECT COALESCE(SUM(
      CASE
        WHEN nc.moneda::text = v_moneda THEN nc.monto
        WHEN v_moneda = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
          THEN nc.monto * nc.tipo_cambio
        WHEN v_moneda <> 'MXN' AND nc.moneda::text = 'MXN' AND v_tc > 1
          THEN nc.monto / v_tc
        WHEN v_moneda <> 'MXN' AND nc.moneda::text <> 'MXN'
             AND v_moneda <> nc.moneda::text
             AND nc.tipo_cambio > 1 AND v_tc > 1
          THEN (nc.monto * nc.tipo_cambio) / v_tc
        ELSE 0
      END), 0) INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id AND nc.deleted_at IS NULL AND nc.estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$function$;

REVOKE ALL ON FUNCTION public.saldo_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura(uuid) TO authenticated, service_role;