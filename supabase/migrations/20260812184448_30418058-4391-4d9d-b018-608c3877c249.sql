-- FIX-H6-14: `siguiente_folio_proveedor(uuid)` es SECURITY DEFINER y quedó sin
-- `REVOKE ALL ... FROM PUBLIC` en su migración original (20260812175701).
-- Esta migración correctiva re-aplica el bloque canónico REVOKE + GRANT.
REVOKE ALL ON FUNCTION public.siguiente_folio_proveedor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siguiente_folio_proveedor(uuid) TO authenticated, service_role;