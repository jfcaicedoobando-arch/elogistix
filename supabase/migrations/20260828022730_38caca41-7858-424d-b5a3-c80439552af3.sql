-- v13.777.9 · Paridad de EXECUTE para replay desde cero: en la base real estas
-- tres funciones internas ya tienen EXECUTE para service_role (y cerrado para
-- anon/authenticated), pero ninguna migración lo emitía.
REVOKE ALL ON FUNCTION public._assert_padre_misma_org() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_padre_misma_org() TO service_role;

REVOKE ALL ON FUNCTION public._sync_user_roles_desde_membership() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._sync_user_roles_desde_membership() TO service_role;

REVOKE ALL ON FUNCTION public.adjuntar_xml_factura_entrante(uuid, text, text, text, text, text, text, date, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjuntar_xml_factura_entrante(uuid, text, text, text, text, text, text, date, numeric, text) TO service_role;