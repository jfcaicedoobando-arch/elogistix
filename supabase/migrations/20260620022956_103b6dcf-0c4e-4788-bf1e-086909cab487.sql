REVOKE EXECUTE ON FUNCTION public.archivar_version_cotizacion(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recotizar_cotizacion(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aceptar_cotizacion_version(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.obtener_costos_cotizacion_version(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recotizar_cotizacion(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_cotizacion_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_costos_cotizacion_version(uuid, int) TO authenticated;