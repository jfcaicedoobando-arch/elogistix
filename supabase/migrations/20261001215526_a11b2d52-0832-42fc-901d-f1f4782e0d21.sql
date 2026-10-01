ALTER FUNCTION public.eerr_resumen_anual(integer, text) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.eerr_resumen_anual(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eerr_resumen_anual(integer, text) TO authenticated, service_role;