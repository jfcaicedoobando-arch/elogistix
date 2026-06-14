CREATE OR REPLACE FUNCTION public.fn_admin_org_activity()
RETURNS TABLE (id uuid, nombre text, embarques bigint, cotizaciones bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.nombre,
    COALESCE(e.cnt, 0) AS embarques,
    COALESCE(c.cnt, 0) AS cotizaciones
  FROM public.organizations o
  LEFT JOIN (
    SELECT organization_id, COUNT(*)::bigint AS cnt
    FROM public.embarques
    WHERE organization_id IS NOT NULL
    GROUP BY organization_id
  ) e ON e.organization_id = o.id
  LEFT JOIN (
    SELECT organization_id, COUNT(*)::bigint AS cnt
    FROM public.cotizaciones
    WHERE organization_id IS NOT NULL
    GROUP BY organization_id
  ) c ON c.organization_id = o.id
  WHERE public.has_role(auth.uid(), 'super_admin'::app_role)
  ORDER BY o.nombre
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_org_activity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_admin_org_activity() TO authenticated;