-- FIX-H6-11: re-aplica REVOKE/GRANT de convertir_prospecto_a_cliente_rpc
REVOKE ALL ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) TO service_role;