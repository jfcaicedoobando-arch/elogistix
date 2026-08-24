-- ============================================================================
-- FIX3 · Ronda-2 P2: tres helpers financieros SECURITY DEFINER dejan de ser
--          ejecutables por `authenticated` (oráculos de lectura cross-tenant).
-- ============================================================================
-- Hallazgo (bugs2/db_rls_round2.md, P2):
--   · public.venta_embarque_mxn_neta(uuid,numeric,numeric)
--   · public.nc_aplicadas_en_moneda_factura(uuid)
--   · public.comision_embarques_de_factura(uuid)
-- Ninguno compara la org del registro con la del llamador y los tres tenían
-- GRANT EXECUTE a `authenticated` → cualquier usuario autenticado (incluido
-- un cliente de portal con UUIDs que circulan en links) podía leer venta
-- neta MXN por embarque, NCs aplicadas por factura y embarques de una
-- factura de OTROS tenants.
--
-- El frontend NO los llama (sólo aparecen en types.ts generado; verificado
-- con grep sobre src/), así que el REVOKE no rompe ningún flujo.
--
-- Callers internos verificados (no necesitan GRANT al rol invocante):
--   · calcular_comision_pago, comisiones_sobre_devengadas,
--     registrar_pago_liquidacion, cancelar_liquidacion_comision y
--     registrar_pago_cliente_lote son SECURITY DEFINER con el mismo owner
--     (rol de migraciones) → la llamada interna sigue autorizada.
--   · El único caller INVOKER era el trigger assert_factura_viva_para_pago
--     (llama nc_aplicadas_en_moneda_factura); la migración
--     20260831100100_fix3_assert_factura_viva_pago_fechas.sql lo pasa a
--     SECURITY DEFINER justamente para cerrar esta vía.
--   · Ninguna policy ni vista los referencia (grep sobre migraciones).
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.comision_embarques_de_factura(uuid) FROM authenticated;

-- Defensa en profundidad: reafirmar que PUBLIC/anon siguen fuera y que sólo
-- service_role conserva EXECUTE directo (llamadas PostgREST de plataforma).
REVOKE ALL ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.comision_embarques_de_factura(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.comision_embarques_de_factura(uuid) TO service_role;
