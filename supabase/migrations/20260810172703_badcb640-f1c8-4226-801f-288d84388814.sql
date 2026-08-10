-- FIX-H6-12: re-aplicación explícita de permisos de las funciones SECURITY DEFINER
-- creadas en la Ola 4 (los permisos en BD ya eran correctos; esto los deja
-- declarados en una migración para el auditor H6).

REVOKE ALL ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.profit_por_cliente(date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profit_por_cliente(date, date, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cancelar_anticipo_proveedor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_anticipo_proveedor(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dashboard_details() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_details() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.operaciones_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.operaciones_stats() TO authenticated, service_role;