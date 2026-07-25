CREATE OR REPLACE FUNCTION public.cxc_aging_clientes(
  p_org uuid DEFAULT NULL::uuid,
  p_fecha date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  cliente_id uuid,
  cliente_nombre text,
  saldo_total numeric,
  vigente numeric,
  d_1_30 numeric,
  d_31_60 numeric,
  d_61_90 numeric,
  mas_90 numeric,
  num_facturas integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
    SELECT factura_id, COALESCE(SUM(monto_aplicado_factura), 0) AS pagado
    FROM public.pagos_factura
    WHERE deleted_at IS NULL
    GROUP BY factura_id
  ),
  nc AS (
    SELECT factura_id, COALESCE(SUM(monto), 0) AS aplicado
    FROM public.factura_notas_credito
    WHERE estado = 'Aplicada' AND deleted_at IS NULL
    GROUP BY factura_id
  ),
  saldos AS (
    SELECT
      f.cliente_id,
      f.cliente_nombre,
      f.id AS factura_id,
      GREATEST(f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.aplicado, 0), 0) AS saldo,
      (p_fecha - COALESCE(f.fecha_vencimiento, f.fecha_emision))::int AS dias_vencido
    FROM public.facturas f
    LEFT JOIN pagado pg ON pg.factura_id = f.id
    LEFT JOIN nc ON nc.factura_id = f.id
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
      AND (v_org IS NULL OR f.organization_id = v_org)
  )
  SELECT
    s.cliente_id,
    MAX(s.cliente_nombre),
    SUM(s.saldo),
    SUM(CASE WHEN s.dias_vencido <= 0 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 1 AND 30 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 31 AND 60 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 61 AND 90 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido > 90 THEN s.saldo ELSE 0 END),
    COUNT(*)::int
  FROM saldos s
  WHERE s.saldo > 0.005
  GROUP BY s.cliente_id
  ORDER BY SUM(s.saldo) DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO service_role;
REVOKE ALL ON FUNCTION public.cxc_aging_clientes(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cxc_aging_clientes(uuid, date) FROM anon;
