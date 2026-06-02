
REVOKE EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_pago_factura_comision() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid) TO authenticated, service_role;
