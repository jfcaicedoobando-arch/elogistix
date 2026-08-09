CREATE OR REPLACE FUNCTION public.saldo_factura_bruto(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_estado estado_factura; v_total numeric; v_pagos numeric;
BEGIN
  SELECT organization_id, estado, COALESCE(total,0)
    INTO v_org, v_estado, v_total
  FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Aislamiento multi-tenant sólo cuando hay usuario autenticado. Los procesos
  -- internos (service_role / migraciones / triggers ejecutados por el backend)
  -- no tienen auth.uid() y deben poder calcular el saldo real; de lo contrario
  -- los guards que dependen de esta función (p.ej. notas de crédito) fallan
  -- devolviendo saldo 0.
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND v_org IS DISTINCT FROM public.current_user_org_id() THEN
    RETURN 0;
  END IF;

  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(pf.monto_aplicado_factura),0) INTO v_pagos
  FROM public.pagos_factura pf
  WHERE pf.factura_id = p_factura_id AND pf.deleted_at IS NULL;

  RETURN v_total - v_pagos;
END;
$function$;

REVOKE ALL ON FUNCTION public.saldo_factura_bruto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.saldo_factura_bruto(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura_bruto(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.saldo_factura_bruto(uuid) IS
  'Saldo pendiente bruto (total - pagos aplicados) de una factura. Devuelve 0 para facturas de otra organización cuando hay usuario autenticado; los procesos internos sin auth.uid() obtienen el saldo real.';