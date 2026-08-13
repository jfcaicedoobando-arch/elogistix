REVOKE ALL ON FUNCTION public.guard_cuenta_bancaria_moneda() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_cuenta_bancaria_moneda() FROM anon;
GRANT EXECUTE ON FUNCTION public.guard_cuenta_bancaria_moneda() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_cuenta_bancaria_moneda() TO service_role;