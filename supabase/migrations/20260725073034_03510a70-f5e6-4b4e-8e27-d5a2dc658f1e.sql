-- QW3 · Aging CxP segmentado por moneda
-- Cambia la firma de retorno de cxp_aging_proveedores para agregar `moneda`
-- y agrupar por (proveedor, moneda). Preserva la lógica de FIX-AGING-NC-01
-- (ignora NCs soft-borradas) y la de aislamiento por organización.

DROP FUNCTION IF EXISTS public.cxp_aging_proveedores(uuid, date);

CREATE OR REPLACE FUNCTION public.cxp_aging_proveedores(
  p_org uuid DEFAULT NULL::uuid,
  p_fecha date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  proveedor_id uuid,
  proveedor_nombre text,
  moneda text,
  saldo_total numeric,
  vigente numeric,
  d_1_30 numeric,
  d_31_60 numeric,
  d_61_90 numeric,
  mas_90 numeric,
  num_facturas integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_org uuid;
  v_is_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
BEGIN
  IF v_caller_org IS NULL AND NOT v_is_super THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: usuario sin organización activa' USING ERRCODE='42501';
  END IF;
  IF v_is_super THEN
    v_org := p_org;
  ELSIF p_org IS NOT NULL AND p_org <> v_caller_org THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: no puedes consultar el aging de otra organización' USING ERRCODE='42501';
  ELSE
    v_org := v_caller_org;
  END IF;

  RETURN QUERY
  WITH pagado AS (
    SELECT proveedor_factura_id,
           COALESCE(SUM(COALESCE(monto_en_moneda_factura, monto)), 0) AS pagado
      FROM public.pagos_proveedor
     WHERE deleted_at IS NULL
     GROUP BY proveedor_factura_id
  ), nc AS (
    SELECT proveedor_factura_id, COALESCE(SUM(monto), 0) AS aplicado
      FROM public.proveedor_notas_credito
     WHERE estado = 'Aplicada' AND deleted_at IS NULL
     GROUP BY proveedor_factura_id
  ), saldos AS (
    SELECT pf.proveedor_id,
           pf.proveedor_nombre,
           COALESCE(pf.moneda, 'MXN') AS moneda,
           pf.id AS factura_id,
           GREATEST(pf.total - COALESCE(pg.pagado, 0) - COALESCE(nc.aplicado, 0), 0) AS saldo,
           (p_fecha - COALESCE(pf.fecha_vencimiento, pf.fecha_emision))::int AS dias_vencido
      FROM public.proveedor_facturas pf
      LEFT JOIN pagado pg ON pg.proveedor_factura_id = pf.id
      LEFT JOIN nc       ON nc.proveedor_factura_id = pf.id
     WHERE pf.deleted_at IS NULL
       AND pf.estado <> 'Cancelada'
       AND (v_org IS NULL OR pf.organization_id = v_org)
  )
  SELECT s.proveedor_id,
         MAX(s.proveedor_nombre),
         s.moneda,
         SUM(s.saldo),
         SUM(CASE WHEN s.dias_vencido <= 0                       THEN s.saldo ELSE 0 END),
         SUM(CASE WHEN s.dias_vencido BETWEEN 1  AND 30           THEN s.saldo ELSE 0 END),
         SUM(CASE WHEN s.dias_vencido BETWEEN 31 AND 60           THEN s.saldo ELSE 0 END),
         SUM(CASE WHEN s.dias_vencido BETWEEN 61 AND 90           THEN s.saldo ELSE 0 END),
         SUM(CASE WHEN s.dias_vencido > 90                        THEN s.saldo ELSE 0 END),
         COUNT(*)::int
    FROM saldos s
   WHERE s.saldo > 0.005
   GROUP BY s.proveedor_id, s.moneda
   ORDER BY SUM(s.saldo) DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.cxp_aging_proveedores(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cxp_aging_proveedores(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.cxp_aging_proveedores(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cxp_aging_proveedores(uuid, date) TO service_role;
