-- FIX-H6-18 — Re-aplica REVOKE/GRANT de las funciones SECURITY DEFINER de
-- reportes que fueron re-emitidas en la Ola 14 sin el bloque de permisos en el
-- mismo archivo (20260814161725, 20260814163218, 20260824080000, 20260824080100).
-- Idempotente: los permisos vigentes en la base ya son estos.

REVOKE ALL ON FUNCTION public.libro_pagos(date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.libro_pagos(date, date, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.conciliacion_resumen(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conciliacion_resumen(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pnl_financiero_embarque(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cxc_aging_clientes(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cxp_aging_proveedores(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cxp_aging_proveedores(uuid, date) TO authenticated, service_role;