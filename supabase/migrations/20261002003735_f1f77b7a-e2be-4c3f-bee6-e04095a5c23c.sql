DROP FUNCTION public.letra_crm(public.crm_empresas);
DROP FUNCTION public.letra_crm(public.crm_oportunidades);
CREATE FUNCTION public.letra_empresa_crm(public.crm_empresas)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$ SELECT public.crm_puntaje_detalle('empresa', $1.id)->>'letra' $$;
CREATE FUNCTION public.letra_oportunidad_crm(public.crm_oportunidades)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$ SELECT public.crm_puntaje_detalle('oportunidad', $1.id)->>'letra' $$;
REVOKE ALL ON FUNCTION public.letra_empresa_crm(public.crm_empresas) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.letra_oportunidad_crm(public.crm_oportunidades) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.letra_empresa_crm(public.crm_empresas) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.letra_oportunidad_crm(public.crm_oportunidades) TO authenticated, service_role;