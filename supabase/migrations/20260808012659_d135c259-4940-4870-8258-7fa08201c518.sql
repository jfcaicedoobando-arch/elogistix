REVOKE ALL ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid) TO service_role;