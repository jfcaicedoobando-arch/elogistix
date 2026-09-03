-- P0 · Cierre de puerta lateral: la función legacy `crm_propagar_conversion_cliente`
-- ya no tiene consumidor frontend y permitía ligar cualquier cliente vivo de la
-- org a una oportunidad propia sin cotización Aceptada/ganadora ni fiscalidad.
-- Sólo se retira el ACL de usuarios; el cuerpo, owner, SECURITY DEFINER y
-- search_path se conservan intactos.
REVOKE ALL ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) TO service_role;

ALTER FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) IS
  'RETIRADA para usuarios (P0 conversion canonica): sin EXECUTE para PUBLIC/anon/authenticated. Permitia ligar un cliente vivo de la org a una oportunidad propia y marcar el lead Convertido sin cotizacion Aceptada/ganadora ni validacion fiscal. La unica ruta valida de conversion es public.convertir_prospecto_a_cliente_rpc(uuid, jsonb). Se conserva el cuerpo y EXECUTE para service_role por compatibilidad de procesos internos.';