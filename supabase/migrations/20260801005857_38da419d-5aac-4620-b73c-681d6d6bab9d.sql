REVOKE EXECUTE ON FUNCTION public.resolver_sin_comision(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolver_sin_comision(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolver_sin_comision(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_sin_comision(uuid) TO service_role;