-- AUD54: deuda monetaria visible, sin reescribir estados ni inferir pagos históricos.
CREATE OR REPLACE FUNCTION public.cobranza_listado(
  p_cliente_id uuid DEFAULT NULL,
  p_moneda text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_estatus text DEFAULT NULL,
  p_limit integer DEFAULT 2000
)
RETURNS TABLE(
  id uuid, numero text, cliente_id uuid, cliente_nombre text, expediente text,
  moneda text, total numeric, pagado numeric, notas_credito_aplicadas numeric, saldo numeric,
  fecha_emision date, fecha_vencimiento date, dias_vencido integer,
  estatus_cobranza text, estado_factura text, tipo_cambio numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := public.org_scope();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 5000);
BEGIN
  IF v_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH cartera AS (
    SELECT
      f.id,
      f.numero,
      f.cliente_id,
      f.cliente_nombre,
      f.expediente,
      f.moneda::text AS moneda,
      f.total,
      COALESCE(pg.pagado, 0)::numeric AS pagado,
      COALESCE(nc.notas, 0)::numeric AS notas,
      GREATEST(0, f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0))::numeric AS saldo,
      f.fecha_emision,
      f.fecha_vencimiento,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento)::integer AS dias_vencido,
      f.estado::text AS estado_factura,
      f.tipo_cambio
    FROM facturas f
    LEFT JOIN LATERAL (
      SELECT SUM(pf.monto_aplicado_factura) AS pagado
      FROM pagos_factura pf
      WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
        AND NOT public.pago_rep_anulado(pf.estado_rep)
    ) pg ON true
    LEFT JOIN LATERAL (
      SELECT public._nc_aplicadas_moneda_factura(f.id) AS notas
    ) nc ON true
    WHERE f.deleted_at IS NULL
      AND (f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
        OR (f.estado = 'Pagada' AND COALESCE(pg.pagado, 0) > 0
          AND ROUND(f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0), 2) > 0))
      AND f.organization_id = v_org
      AND (p_cliente_id IS NULL OR f.cliente_id = p_cliente_id)
      AND (p_moneda IS NULL OR f.moneda::text = p_moneda)
      AND (
        p_search IS NULL OR p_search = ''
        OR f.numero ILIKE '%' || p_search || '%'
        OR f.cliente_nombre ILIKE '%' || p_search || '%'
      )
  ), clasificada AS (
    SELECT c.*,
      CASE
        WHEN ROUND(c.saldo, 2) <= 0 THEN 'Sin saldo'
        WHEN c.dias_vencido > 0 THEN 'Vencida'
        WHEN c.dias_vencido BETWEEN -7 AND 0 THEN 'Por vencer'
        ELSE 'Vigente'
      END AS estatus
    FROM cartera c
  )
  SELECT
    cl.id, cl.numero, cl.cliente_id, cl.cliente_nombre, cl.expediente,
    cl.moneda, cl.total, cl.pagado, cl.notas, cl.saldo,
    cl.fecha_emision, cl.fecha_vencimiento, cl.dias_vencido,
    cl.estatus, cl.estado_factura, cl.tipo_cambio
  FROM clasificada cl
  WHERE p_estatus IS NULL OR p_estatus = '' OR p_estatus = 'todos'
     OR cl.estatus = p_estatus
  ORDER BY cl.fecha_vencimiento ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.cobranza_listado(uuid, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranza_listado(uuid, text, text, text, integer) TO authenticated, service_role;
