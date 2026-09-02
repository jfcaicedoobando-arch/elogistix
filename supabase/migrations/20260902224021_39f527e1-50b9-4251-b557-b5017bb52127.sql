-- v13.823.60 · Autorización y ownership de leads (servidor).
-- Forward-only: redefine crm_calificar_prospecto / crm_tomar_lead con helpers
-- in-org (has_any_role_in_org + rls_tenant_scope_ok) en lugar de has_role
-- global, y recrea las policies de crm_leads sin escritura por rol global.

-- 1) crm_calificar_prospecto ------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_calificar_prospecto(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead public.crm_leads;
  v_email text;
  v_faltantes text[] := ARRAY[]::text[];
  v_gestion_total boolean;
  v_vendedor boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO';
  END IF;

  SELECT * INTO v_lead
  FROM public.crm_leads
  WHERE id = p_lead_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'LC_LEAD_NO_ENCONTRADO';
  END IF;

  -- Membresía real en la organización DEL LEAD + tenant activo del super admin.
  IF NOT public.is_org_member(v_lead.organization_id)
     OR NOT public.rls_tenant_scope_ok(v_lead.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  v_gestion_total := public.has_any_role_in_org(
    auth.uid(),
    ARRAY['admin', 'gerente_comercial']::public.app_role[],
    v_lead.organization_id
  );
  v_vendedor := public.has_any_role_in_org(
    auth.uid(),
    ARRAY['vendedor']::public.app_role[],
    v_lead.organization_id
  );

  -- Falla cerrado: sin responsable no hay ownership que validar.
  IF v_lead.vendedor_id IS NULL THEN
    RAISE EXCEPTION 'LC_LEAD_SIN_ASIGNAR';
  END IF;

  IF NOT v_gestion_total
     AND NOT (v_vendedor AND v_lead.vendedor_id = auth.uid()) THEN
    RAISE EXCEPTION 'LC_LEAD_SIN_PERMISO_CALIFICAR';
  END IF;

  IF v_lead.estado::text IN ('Descalificado', 'Convertido') THEN
    RAISE EXCEPTION 'LC_LEAD_ESTADO_NO_CALIFICABLE';
  END IF;

  -- Perfil comercial mínimo (ICP) ANTES del retorno idempotente: un retry con
  -- expediente incompleto debe avisar, no devolver éxito mudo.
  IF NULLIF(TRIM(COALESCE(v_lead.sector, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'sector';
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.mercancia, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'mercancia';
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.rutas, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'rutas';
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.volumen, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'volumen';
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.frecuencia, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'frecuencia';
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.dolor_explicito, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'dolor_explicito';
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.proveedor_actual, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'proveedor_actual';
  END IF;

  IF array_length(v_faltantes, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'LC_LEAD_PERFIL_INCOMPLETO: %', array_to_string(v_faltantes, ',');
  END IF;

  -- Idempotente: recalificar un prospecto no es error (doble click / retry).
  IF v_lead.estado::text IN ('Prospecto', 'Pendiente de alta') THEN
    RETURN jsonb_build_object(
      'lead_id', v_lead.id,
      'estado', v_lead.estado,
      'calificado', false
    );
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.crm_leads
     SET estado = 'Prospecto'::public.crm_lead_estado,
         estatus_icp = 'calificado',
         updated_at = now()
   WHERE id = v_lead.id;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo,
    entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_lead.organization_id, auth.uid(), COALESCE(v_email, ''),
    'crm_calificar_prospecto', 'crm', v_lead.id, COALESCE(v_lead.empresa, ''),
    jsonb_build_object('estado_anterior', v_lead.estado, 'estado_nuevo', 'Prospecto')
  );

  RETURN jsonb_build_object(
    'lead_id', v_lead.id,
    'estado', 'Prospecto',
    'calificado', true
  );
END;
$function$;

ALTER FUNCTION public.crm_calificar_prospecto(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.crm_calificar_prospecto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_calificar_prospecto(uuid) TO authenticated, service_role;

-- 2) crm_tomar_lead --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_tomar_lead(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead public.crm_leads;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO';
  END IF;

  -- FOR UPDATE: serializa tomas simultáneas del mismo lead.
  SELECT * INTO v_lead
  FROM public.crm_leads
  WHERE id = p_lead_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'LC_LEAD_NO_ENCONTRADO';
  END IF;

  IF NOT public.is_org_member(v_lead.organization_id)
     OR NOT public.rls_tenant_scope_ok(v_lead.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  -- Rol EFECTIVO en la organización del lead (jerarquía de 'vendedor' incluye
  -- gerente_comercial / admin_org / super_admin); ya no un has_role global.
  IF NOT public.has_any_role_in_org(
       auth.uid(),
       ARRAY['vendedor', 'admin']::public.app_role[],
       v_lead.organization_id
     ) THEN
    RAISE EXCEPTION 'LC_LEAD_SIN_PERMISO_TOMA';
  END IF;

  -- Idempotente: re-tomar un lead ya propio no es error (doble click/retry).
  IF v_lead.vendedor_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'lead_id', v_lead.id,
      'vendedor_id', v_lead.vendedor_id,
      'tomado', false
    );
  END IF;
  IF v_lead.vendedor_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_LEAD_YA_ASIGNADO';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.crm_leads
     SET vendedor_id = auth.uid(),
         vendedor_email = COALESCE(v_email, ''),
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'lead_id', v_lead.id,
    'vendedor_id', auth.uid(),
    'tomado', true
  );
END;
$function$;

ALTER FUNCTION public.crm_tomar_lead(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.crm_tomar_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_tomar_lead(uuid) TO authenticated, service_role;

-- 3) RLS crm_leads ---------------------------------------------------------
-- Se conserva intacta la policy RESTRICTIVE "Scope tenant activo super admin".
DROP POLICY IF EXISTS "Staff CRUD crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Tenant viewer crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Vendedor own crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Vendedor bolsa crm_leads" ON public.crm_leads;

-- Gestión total in-org: admin / admin_org / super_admin / gerente_comercial.
CREATE POLICY "Gestion leads in-org crm_leads"
ON public.crm_leads
FOR ALL
TO authenticated
USING (
  public.rls_tenant_scope_ok(organization_id)
  AND public.has_any_role_in_org(
        (SELECT auth.uid()),
        ARRAY['admin', 'gerente_comercial']::public.app_role[],
        organization_id)
)
WITH CHECK (
  public.rls_tenant_scope_ok(organization_id)
  AND public.has_any_role_in_org(
        (SELECT auth.uid()),
        ARRAY['admin', 'gerente_comercial']::public.app_role[],
        organization_id)
);

-- Vendedor efectivo: escritura SÓLO sobre su propio lead. El WITH CHECK repite
-- vendedor_id = auth.uid() y valida la organización de la fila resultante, así
-- que no puede cambiar organization_id ni vendedor_id para quedarse una ajena.
CREATE POLICY "Vendedor own crm_leads"
ON public.crm_leads
FOR ALL
TO authenticated
USING (
  public.rls_tenant_scope_ok(organization_id)
  AND vendedor_id = (SELECT auth.uid())
  AND public.has_any_role_in_org(
        (SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[],
        organization_id)
)
WITH CHECK (
  public.rls_tenant_scope_ok(organization_id)
  AND vendedor_id = (SELECT auth.uid())
  AND public.has_any_role_in_org(
        (SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[],
        organization_id)
);

-- Bolsa común: sólo LECTURA. La apropiación pasa exclusivamente por
-- crm_tomar_lead (SECURITY DEFINER); no se abre UPDATE genérico.
CREATE POLICY "Vendedor bolsa crm_leads"
ON public.crm_leads
FOR SELECT
TO authenticated
USING (
  public.rls_tenant_scope_ok(organization_id)
  AND vendedor_id IS NULL
  AND public.has_any_role_in_org(
        (SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[],
        organization_id)
);

-- Lectura in-org para consulta/operación (viewer y su jerarquía). Nunca
-- concede escritura.
CREATE POLICY "Lectura in-org crm_leads"
ON public.crm_leads
FOR SELECT
TO authenticated
USING (
  public.rls_tenant_scope_ok(organization_id)
  AND public.has_any_role_in_org(
        (SELECT auth.uid()),
        ARRAY['viewer']::public.app_role[],
        organization_id)
);

-- 4) ACL de tabla: anon nunca toca leads.
REVOKE ALL ON TABLE public.crm_leads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_leads TO authenticated;
GRANT ALL ON TABLE public.crm_leads TO service_role;