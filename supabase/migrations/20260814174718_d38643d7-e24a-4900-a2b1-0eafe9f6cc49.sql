-- Ola 16 · plano plataforma: KPIs por organización para /admin/organizaciones/:id
CREATE OR REPLACE FUNCTION public.fn_admin_org_counts(_org uuid)
RETURNS TABLE(miembros bigint, embarques bigint, clientes bigint, cotizaciones bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_SOLO_SUPER_ADMIN: telemetría de plataforma restringida';
  END IF;
  IF _org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_REQUERIDA: falta la organización';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.organization_members m WHERE m.organization_id = _org),
    (SELECT count(*) FROM public.embarques e WHERE e.organization_id = _org AND e.deleted_at IS NULL),
    (SELECT count(*) FROM public.clientes c WHERE c.organization_id = _org AND c.deleted_at IS NULL),
    (SELECT count(*) FROM public.cotizaciones q WHERE q.organization_id = _org AND q.deleted_at IS NULL);
END;
$function$;

COMMENT ON FUNCTION public.fn_admin_org_counts(uuid) IS
  'Ola 16 · plano plataforma: KPIs de una organización para la consola super admin. Fail-closed para no super admins.';

REVOKE ALL ON FUNCTION public.fn_admin_org_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_admin_org_counts(uuid) TO authenticated, service_role;
