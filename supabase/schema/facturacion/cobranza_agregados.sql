-- AUD54: deuda monetaria visible, sin reescribir estados ni inferir pagos históricos.
CREATE OR REPLACE FUNCTION public.cobranza_agregados(
  p_cliente_id uuid DEFAULT NULL,
  p_moneda text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH cartera AS (
    SELECT
      f.moneda::text AS moneda,
      GREATEST(0, f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0)) AS saldo,
      (public.fecha_negocio_mx() - f.fecha_vencimiento) AS dias_vencido
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
      AND f.organization_id = public.org_scope()
      AND (p_cliente_id IS NULL OR f.cliente_id = p_cliente_id)
      AND (p_moneda IS NULL OR f.moneda::text = p_moneda)
  )
  SELECT jsonb_build_object(
    'total_mxn',          COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'MXN' AND ROUND(saldo, 2) > 0), 0),
    'total_usd',          COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'USD' AND ROUND(saldo, 2) > 0), 0),
    'vencido_mxn',        COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'MXN' AND ROUND(saldo, 2) > 0 AND dias_vencido > 0), 0),
    'vencido_usd',        COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'USD' AND ROUND(saldo, 2) > 0 AND dias_vencido > 0), 0),
    'por_vencer_7d_mxn',  COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'MXN' AND ROUND(saldo, 2) > 0 AND dias_vencido BETWEEN -7 AND 0), 0),
    'por_vencer_7d_usd',  COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'USD' AND ROUND(saldo, 2) > 0 AND dias_vencido BETWEEN -7 AND 0), 0),
    'facturas_vencidas',  COUNT(*) FILTER (WHERE ROUND(saldo, 2) > 0 AND dias_vencido > 0),
    'facturas_con_saldo', COUNT(*) FILTER (WHERE ROUND(saldo, 2) > 0)
  ) INTO v_result
  FROM cartera;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.cobranza_agregados(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranza_agregados(uuid, text) TO authenticated, service_role;
