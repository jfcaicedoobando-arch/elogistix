REVOKE ALL ON FUNCTION public.validar_cierre_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public._convertir_proformas_insertar_conceptos(uuid, uuid[], uuid, boolean, public.moneda) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._convertir_proformas_insertar_conceptos(uuid, uuid[], uuid, boolean, public.moneda) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.registrar_pago_cliente_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_cliente_lote(jsonb) TO authenticated, service_role;