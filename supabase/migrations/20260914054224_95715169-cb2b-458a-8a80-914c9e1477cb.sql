REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp() FROM anon;
GRANT EXECUTE ON FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp() TO service_role;

REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO service_role;