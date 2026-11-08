-- Aplica en producción los cierres de ejecución que nunca llegaron
-- (supabase/migrations/20260724130100 y espejos replay de pricing/CRM,
-- revisado 2026-11-08). Todos los llamadores vivos son SECURITY DEFINER.

REVOKE EXECUTE ON FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public._costeo_tarifa_solicitud_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._costeo_tarifa_solicitud_guard() TO service_role;

REVOKE ALL ON FUNCTION public._crm_empresa_estado_por_cliente() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_empresa_estado_por_cliente() TO service_role;

REVOKE ALL ON FUNCTION public._crm_folio_pricing_prefijo(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._crm_folio_pricing_prefijo(timestamptz) TO authenticated, service_role;