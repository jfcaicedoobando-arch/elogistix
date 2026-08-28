REVOKE ALL ON FUNCTION public._bitacora_cambio_financiero() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._bitacora_cambio_financiero() TO service_role;