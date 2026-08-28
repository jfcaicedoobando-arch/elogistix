REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) TO service_role;