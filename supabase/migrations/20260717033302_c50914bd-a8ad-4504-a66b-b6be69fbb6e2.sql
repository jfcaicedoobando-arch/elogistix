
REVOKE ALL ON FUNCTION public.handle_new_organization() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_organization() TO service_role;
