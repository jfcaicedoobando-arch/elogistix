REVOKE ALL ON FUNCTION public.comisiones_sobre_devengadas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comisiones_sobre_devengadas() TO authenticated, service_role;