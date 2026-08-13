-- FIX-H6-16: re-aplica el bloque canónico de permisos de public.pnl_financiero_embarque(uuid)
REVOKE ALL ON FUNCTION public.pnl_financiero_embarque(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pnl_financiero_embarque(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated, service_role;