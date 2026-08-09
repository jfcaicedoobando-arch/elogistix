-- A4: eliminar la variante legacy de reapertura (sin bypass de transición).
DROP FUNCTION IF EXISTS public.reabrir_embarque_con_motivo(uuid, text);

-- A8: cartera del cliente con saldo real (los edge functions consultaban
-- facturas.saldo, columna que no existe -> error 500 permanente).
CREATE OR REPLACE FUNCTION public.facturas_cartera_cliente(
  p_cliente_id uuid,
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  numero text,
  serie text,
  folio text,
  cliente_id uuid,
  cliente_nombre text,
  total numeric,
  saldo numeric,
  moneda text,
  estado text,
  fecha_emision date,
  fecha_vencimiento date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_uid uuid := auth.uid();
  v_caller_org uuid;
BEGIN
  SELECT c.organization_id INTO v_org
  FROM public.clientes c WHERE c.id = p_cliente_id AND c.deleted_at IS NULL;
  IF v_org IS NULL THEN RETURN; END IF;

  -- Fail-closed para usuarios finales de otra organización.
  IF v_uid IS NOT NULL
     AND COALESCE(auth.role()::text, '') <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    v_caller_org := public.current_user_org_id();
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT f.id,
         f.organization_id,
         f.numero::text,
         f.serie::text,
         f.folio::text,
         f.cliente_id,
         f.cliente_nombre::text,
         COALESCE(f.total, 0)::numeric,
         (COALESCE(f.total, 0)
           - COALESCE((SELECT SUM(p.monto_aplicado_factura) FROM public.pagos_factura p
                        WHERE p.factura_id = f.id AND p.deleted_at IS NULL), 0)
           - COALESCE((SELECT SUM(nc.monto) FROM public.factura_notas_credito nc
                        WHERE nc.factura_id = f.id AND nc.deleted_at IS NULL
                          AND nc.estado = 'Aplicada'), 0))::numeric AS saldo,
         f.moneda::text,
         f.estado::text,
         f.fecha_emision,
         f.fecha_vencimiento
  FROM public.facturas f
  WHERE f.cliente_id = p_cliente_id
    AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Borrador', 'Cancelada', 'Sustituida')
    AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
    AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  ORDER BY f.fecha_emision;
END;
$$;

REVOKE ALL ON FUNCTION public.facturas_cartera_cliente(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.facturas_cartera_cliente(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.facturas_cartera_cliente(uuid, date, date) TO service_role;