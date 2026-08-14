REVOKE ALL ON FUNCTION public.aceptar_cotizacion_version(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aceptar_cotizacion_version(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.aceptar_cotizacion_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_cotizacion_version(uuid) TO service_role;