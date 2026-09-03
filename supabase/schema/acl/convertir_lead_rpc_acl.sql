-- v13.823.63 · Retiro del flujo heredado "Convertir lead".
-- Sólo ACL + COMMENT: NO se reescribe el cuerpo, ni el owner, ni SECURITY
-- DEFINER, ni search_path de la función.

REVOKE ALL ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM anon;
REVOKE ALL ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM authenticated;

-- Compatibilidad interna privilegiada.
GRANT EXECUTE ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) TO service_role;

COMMENT ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) IS
  'RETIRADA v13.823.63: flujo heredado "Convertir lead". Ya no es ejecutable por anon/authenticated (sólo service_role, compatibilidad interna). Usar el flujo canónico: perfil ICP -> crm_calificar_prospecto -> oportunidad -> cotizacion aceptada -> convertir_prospecto_a_cliente_rpc.';