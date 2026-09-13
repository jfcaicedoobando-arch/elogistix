-- H6 · permisos explícitos para las funciones SECURITY DEFINER redefinidas en
-- 20260913005047 (current_user_org_id, set_garantia_estado, aprobar_factura_proveedor).
-- Re-ejecutar CREATE OR REPLACE no altera los ACL, pero el guardrail exige que
-- toda migración que redefina una SECURITY DEFINER declare su REVOKE/GRANT.

REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_garantia_estado(uuid, text, date, date, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_garantia_estado(uuid, text, date, date, numeric, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) TO authenticated, service_role;