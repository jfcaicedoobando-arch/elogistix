CREATE OR REPLACE FUNCTION public._crm_es_pricing(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'super_admin') OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.organization_id = p_org
      AND om.role IN ('ejecutivo_pricing','gerente_operaciones','admin_org','admin'));
$function$;
REVOKE ALL ON FUNCTION public._crm_es_pricing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._crm_es_pricing(uuid) TO authenticated, service_role;
