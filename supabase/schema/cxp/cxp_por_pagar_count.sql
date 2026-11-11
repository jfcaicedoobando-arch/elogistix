CREATE OR REPLACE FUNCTION public.cxp_por_pagar_count()
RETURNS bigint
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $$
  SELECT count(*)
  FROM public.proveedor_facturas pf
  JOIN public.v_proveedor_facturas_saldo s ON s.proveedor_factura_id = pf.id
  WHERE pf.deleted_at IS NULL AND pf.estado::text = 'Vigente';
$$;

REVOKE ALL ON FUNCTION public.cxp_por_pagar_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cxp_por_pagar_count() TO authenticated, service_role;
