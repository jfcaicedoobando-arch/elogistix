REVOKE ALL ON FUNCTION public.cerrar_embarque(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cerrar_embarque(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.archivar_version_cotizacion(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archivar_version_cotizacion(uuid, text) TO authenticated, service_role;