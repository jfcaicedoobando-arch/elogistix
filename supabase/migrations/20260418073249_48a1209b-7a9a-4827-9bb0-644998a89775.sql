CREATE OR REPLACE FUNCTION public.get_user_context()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'role', (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
    'orgRole', (SELECT role::text FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1),
    'organizationId', (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1),
    'organization', (
      SELECT jsonb_build_object('id', o.id, 'nombre', o.nombre, 'logo_url', o.logo_url, 'plan', o.plan, 'rfc', o.rfc, 'activo', o.activo)
      FROM public.organizations o
      WHERE o.id = (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1)
    )
  );
$$;