CREATE OR REPLACE FUNCTION public.get_current_agente_context()
RETURNS TABLE (
  agente_id uuid,
  organization_id uuid,
  proveedor_id uuid,
  agente_nombre text,
  organizacion_nombre text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.agente_id,
         au.organization_id,
         ca.proveedor_id,
         ca.nombre,
         o.nombre
    FROM public.agente_users au
    LEFT JOIN public.costeo_agentes ca ON ca.id = au.agente_id
    LEFT JOIN public.organizations  o  ON o.id  = au.organization_id
   WHERE au.user_id = auth.uid()
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_agente_context() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_current_agente_context() TO authenticated;