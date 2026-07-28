REVOKE ALL ON FUNCTION public.seed_demo_organization() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_demo_organization() FROM anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization() TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization() TO postgres;