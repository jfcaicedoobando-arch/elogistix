REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_context() TO authenticated, service_role;