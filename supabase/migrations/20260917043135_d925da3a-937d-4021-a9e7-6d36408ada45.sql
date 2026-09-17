-- FIX-H6-09: la migración 20260917035459 (lote MNY anticipos P1) re-emitió tres
-- rutinas SECURITY DEFINER sin el bloque ACL canónico en el mismo archivo.
-- Esta migración correctiva re-aplica los permisos de forma idempotente; el
-- archivo original queda como legacy auditado e inmutable.

REVOKE ALL ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, public.moneda, date, numeric, text, text, uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, public.moneda, date, numeric, text, text, uuid, text, uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.devolver_anticipo_proveedor(uuid, numeric, date, uuid, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.guard_pago_proveedor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_pago_proveedor() TO service_role;