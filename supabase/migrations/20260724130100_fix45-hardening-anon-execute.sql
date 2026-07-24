-- ============================================================================
-- FIX-45-HARDENING (auditoría de tests 2026-07-24, hallazgo H3/fix45)
--
-- `fix45_anon_execute_whitelist.sql` reporta 6 funciones SECURITY DEFINER
-- ejecutables por `anon` fuera de la whitelist (expuestas por los GRANTs
-- por defecto de PUBLIC, no por decisión explícita):
--
--   · 5 triggers/helpers internos que NADIE debería invocar por RPC:
--       assert_pago_sin_rep_vivo_delete()
--       calc_pago_retenciones()
--       calcular_comision_pago()  [ambas sobrecargas]
--       tg_facturas_link_proforma()
--       tg_liberar_folio_proveedor_factura()
--     → EXECUTE solo para service_role (patrón del guard CxP, FIX-R3-01).
--
--   · is_org_member(uuid): helper de autorización usado por la app.
--     → se retira de PUBLIC/anon; se conserva authenticated + service_role.
--
-- Más el endurecimiento gemelo en supabase/tests/rls/_ci_post_migrate.sql
-- (dejar de otorgar TODO a anon en CI) y la conexión de
-- fix45_anon_execute_whitelist.sql al workflow rls-tests.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.assert_pago_sin_rep_vivo_delete() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.assert_pago_sin_rep_vivo_delete() TO service_role;

REVOKE EXECUTE ON FUNCTION public.calc_pago_retenciones() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.calc_pago_retenciones() TO service_role;

REVOKE EXECUTE ON FUNCTION public.calcular_comision_pago() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.calcular_comision_pago() TO service_role;

REVOKE EXECUTE ON FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.tg_facturas_link_proforma() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.tg_facturas_link_proforma() TO service_role;

REVOKE EXECUTE ON FUNCTION public.tg_liberar_folio_proveedor_factura() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.tg_liberar_folio_proveedor_factura() TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_org_member(p_org uuid) FROM PUBLIC, anon;
