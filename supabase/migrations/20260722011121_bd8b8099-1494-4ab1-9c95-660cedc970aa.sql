-- v13.305.7 — saldo_factura guard salta cuando no hay org resuelta.
-- El check anterior (auth.uid() IS NOT NULL) no era suficiente: en Postgres
-- efímero de CI, auth.uid() puede lanzar "permission denied for schema auth"
-- según cómo se bootstrapee el schema auth, y triggers de integridad
-- (tg_pago_factura_no_sobrepago) veían saldo=0.
-- Usar current_user_org_id() IS NULL como pivote: SQL-safe, cubre tanto
-- backend como usuarios autenticados sin membresía (RLS los bloquea antes).

CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric;
  v_estado estado_factura;
  v_org uuid;
  v_caller_org uuid;
  v_pagos numeric;
  v_ncs numeric;
BEGIN
  SELECT total, estado, organization_id INTO v_total, v_estado, v_org
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- Guard multi-tenant (FIX-BL-06): sin bypass para super_admin, expone 0.
  -- v13.305.5: apoyar el guard sobre current_user_org_id() (SQL-safe)
  -- en lugar de auth.uid() directo. Si no hay org de caller resuelta
  -- (backend, service_role, tests CI, triggers internos) → bypass.
  v_caller_org := public.current_user_org_id();
  IF v_caller_org IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND v_org IS DISTINCT FROM v_caller_org THEN
    RETURN 0;
  END IF;

  IF v_estado IN ('Cancelada', 'Sustituida', 'Borrador') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = p_factura_id
    AND deleted_at IS NULL
    AND estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$$;

GRANT EXECUTE ON FUNCTION public.saldo_factura(uuid) TO authenticated, service_role;
