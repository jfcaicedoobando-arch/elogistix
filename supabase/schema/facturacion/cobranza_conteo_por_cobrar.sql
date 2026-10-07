-- Audit141: same balance, eligibility, threshold and Mexico business day as cobranza_listado.
-- Aggregate the complete tenant portfolio; never count a truncated client page.
CREATE OR REPLACE FUNCTION public.cobranza_conteo_por_cobrar(p_organization_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.facturas f
  LEFT JOIN LATERAL (
    SELECT SUM(pf.monto_aplicado_factura) AS pagado
    FROM public.pagos_factura pf
    WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
      AND NOT public.pago_rep_anulado(pf.estado_rep)
  ) pg ON true
  WHERE f.organization_id = public.org_scope()
    AND f.organization_id = p_organization_id
    AND f.deleted_at IS NULL
    AND (f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
      OR (f.estado='Pagada' AND COALESCE(pg.pagado,0)>0))
    AND (f.fecha_vencimiento IS NULL OR f.fecha_vencimiento >= public.fecha_negocio_mx())
    AND ROUND(f.total - COALESCE(pg.pagado, 0)
      - COALESCE(public._nc_aplicadas_moneda_factura(f.id), 0),2) > 0;
$$;
REVOKE ALL ON FUNCTION public.cobranza_conteo_por_cobrar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranza_conteo_por_cobrar(uuid) TO authenticated, service_role;
