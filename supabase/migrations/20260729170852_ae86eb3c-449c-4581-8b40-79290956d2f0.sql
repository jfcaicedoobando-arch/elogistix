-- FIX-H6-02: re-aplica el contrato de permisos de la función SECURITY DEFINER
-- public.convertir_proformas_a_factura, creada en 20260729164301 sin el bloque
-- REVOKE/GRANT explícito. Idempotente: en BD los permisos ya son correctos.
REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO service_role;