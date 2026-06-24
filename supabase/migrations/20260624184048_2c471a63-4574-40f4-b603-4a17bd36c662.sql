CREATE OR REPLACE FUNCTION public.get_current_agente_org_nombre()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.nombre
  FROM public.organizations o
  WHERE o.id = public.current_agente_org()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_agente_org_nombre() TO authenticated;