-- FIX-H6-13: re-aplicar permisos de funciones SECURITY DEFINER de CxP
REVOKE ALL ON FUNCTION public._cxp_desvincular_por_rechazo(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cxp_desvincular_por_rechazo(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public._cxp_desvincular_por_rechazo(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) TO service_role;