-- Ola 12 · Sprint 10 (seguimiento H6): tras el REVOKE de la migración
-- anterior hay que re-otorgar EXECUTE a los roles legítimos.
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM anon;