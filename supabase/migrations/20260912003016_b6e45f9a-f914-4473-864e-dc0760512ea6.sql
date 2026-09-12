REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._cxp_validar_aprobacion(uuid, text) TO service_role;