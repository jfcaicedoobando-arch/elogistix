REVOKE ALL ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) TO authenticated, service_role;