-- ============================================================================
-- FIX4 tanda 4 · P3 · venta_embarque_mxn_neta vuelve a quedar service_role-only
--
-- Drift detectado por el nuevo candado bidireccional de CI
-- (_ci_check_service_role_only.sql): la migración espejo
-- 20260826003000_ola2_comisiones_espejo.sql (replay de comisiones) re-otorga
-- EXECUTE a `authenticated` sobre public.venta_embarque_mxn_neta DESPUÉS del
-- REVOKE de 20260831100200 (FIX3 ronda 2 P2: helper financiero sin filtro de
-- organización = oráculo de lectura cross-tenant). En un replay limpio el
-- helper quedaba abierto y sólo el re-cierre de _ci_post_migrate.sql lo
-- enmascaraba en CI; en prod aplicado en orden quedaba expuesto.
--
-- Se re-emite el cierre como última palabra y la función entra a la lista
-- canónica _ci_service_role_only.sql para que el candado lo vigile.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) FROM authenticated;
REVOKE ALL ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) TO service_role;
