CREATE OR REPLACE FUNCTION public.saldo_factura_bruto(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_org uuid; v_uid uuid; v_caller_org uuid;
  v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT f.total, f.organization_id INTO v_total, v_org
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador');
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Ancla tenant: mismo candado que public.saldo_factura.
  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();
  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN 0;
    END IF;
  END IF;

  SELECT COALESCE(SUM(p.monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura p
  WHERE p.factura_id = p_factura_id AND p.deleted_at IS NULL;

  SELECT COALESCE(SUM(nc.monto), 0) INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id AND nc.deleted_at IS NULL
    AND nc.estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$function$;