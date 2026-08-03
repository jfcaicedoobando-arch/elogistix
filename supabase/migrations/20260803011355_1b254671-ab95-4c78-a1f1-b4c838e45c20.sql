-- ============ FIX 3 (R6): bitácora legible por todo miembro de la org ============
UPDATE public.bitacora_actividad b
SET organization_id = m.organization_id
FROM public.organization_members m
WHERE b.organization_id IS NULL
  AND m.user_id = b.usuario_id;

DROP POLICY IF EXISTS "Tenant user own bitacora" ON public.bitacora_actividad;

CREATE POLICY "Tenant members read bitacora"
ON public.bitacora_actividad
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT m.organization_id FROM public.organization_members m
    WHERE m.user_id = (SELECT auth.uid())
  )
);

-- ============ FIX 4 (R6): org activa determinista y con datos ============
CREATE OR REPLACE FUNCTION public.default_user_org_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_count FROM public.organization_members WHERE user_id = v_uid;
  IF v_count = 0 THEN RETURN NULL; END IF;

  IF v_count = 1 THEN
    SELECT organization_id INTO v_org FROM public.organization_members WHERE user_id = v_uid;
    RETURN v_org;
  END IF;

  SELECT m.organization_id INTO v_org
  FROM public.organization_members m
  LEFT JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = v_uid
  ORDER BY
    (CASE WHEN EXISTS (SELECT 1 FROM public.embarques e WHERE e.organization_id = m.organization_id)
            OR EXISTS (SELECT 1 FROM public.cotizaciones c WHERE c.organization_id = m.organization_id)
          THEN 0 ELSE 1 END) ASC,
    (CASE WHEN coalesce(o.nombre, '') ILIKE '%demo%' THEN 1 ELSE 0 END) ASC,
    m.created_at ASC,
    m.organization_id ASC
  LIMIT 1;

  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.default_user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.default_user_org_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.default_user_org_id();
$$;

CREATE OR REPLACE FUNCTION public.get_user_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'role', (
      SELECT role::text FROM public.user_roles
      WHERE user_id = auth.uid()
      ORDER BY CASE role::text
        WHEN 'super_admin' THEN 1 WHEN 'admin_org' THEN 2 WHEN 'admin' THEN 3
        WHEN 'gerente_operaciones' THEN 4 WHEN 'contador' THEN 5 WHEN 'tesorero' THEN 6
        WHEN 'ejecutivo_pricing' THEN 7 WHEN 'coordinador_logistico' THEN 8
        WHEN 'operador' THEN 9 WHEN 'vendedor' THEN 10 WHEN 'customer_service' THEN 11
        WHEN 'viewer' THEN 12 WHEN 'cliente' THEN 13 ELSE 99
      END LIMIT 1
    ),
    'orgRole', (
      SELECT role::text FROM public.organization_members
      WHERE user_id = auth.uid()
      ORDER BY CASE role::text
        WHEN 'super_admin' THEN 1 WHEN 'admin_org' THEN 2 WHEN 'admin' THEN 3
        WHEN 'gerente_operaciones' THEN 4 WHEN 'contador' THEN 5 WHEN 'tesorero' THEN 6
        WHEN 'ejecutivo_pricing' THEN 7 WHEN 'coordinador_logistico' THEN 8
        WHEN 'operador' THEN 9 WHEN 'vendedor' THEN 10 WHEN 'customer_service' THEN 11
        WHEN 'viewer' THEN 12 WHEN 'cliente' THEN 13 ELSE 99
      END LIMIT 1
    ),
    'organizationId', public.default_user_org_id(),
    'organization', (
      SELECT jsonb_build_object(
        'id', o.id, 'nombre', o.nombre, 'logo_url', o.logo_url, 'plan', o.plan,
        'rfc', o.rfc, 'activo', o.activo,
        'direccion', o.direccion,
        'moneda_preferida', o.moneda_preferida,
        'onboarding_completado', o.onboarding_completado
      )
      FROM public.organizations o
      WHERE o.id = public.default_user_org_id()
    )
  );
$$;