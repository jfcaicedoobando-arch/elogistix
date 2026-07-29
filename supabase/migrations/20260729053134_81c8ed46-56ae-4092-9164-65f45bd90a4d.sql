REVOKE ALL ON FUNCTION public.embarques_list_extras(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.embarques_list_extras(uuid[]) TO authenticated, service_role;