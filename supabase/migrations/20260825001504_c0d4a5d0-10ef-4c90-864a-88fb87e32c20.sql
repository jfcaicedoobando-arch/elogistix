-- ============================================================================
-- FIX4 tanda 4 · P3 · cierre de 5 trigger functions service_role-only
--
-- El candado bidireccional (_ci_service_role_only.sql / fix4_service_role_only_grants)
-- detectó que estas funciones de trigger seguían ejecutables por
-- PUBLIC/anon/authenticated en la BD viva: nunca traían REVOKE en su migración
-- original. Revocar EXECUTE NO afecta el disparo de los triggers (se ejecutan
-- con los privilegios del disparo, no del invocador de la API).
-- ============================================================================

REVOKE ALL ON FUNCTION public.assert_pago_sin_rep_vivo_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_pago_sin_rep_vivo_delete() TO service_role;

REVOKE ALL ON FUNCTION public.calc_pago_retenciones() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calc_pago_retenciones() TO service_role;

REVOKE ALL ON FUNCTION public.calcular_comision_pago() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago() TO service_role;

REVOKE ALL ON FUNCTION public.tg_facturas_link_proforma() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_facturas_link_proforma() TO service_role;

REVOKE ALL ON FUNCTION public.tg_liberar_folio_proveedor_factura() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_liberar_folio_proveedor_factura() TO service_role;
