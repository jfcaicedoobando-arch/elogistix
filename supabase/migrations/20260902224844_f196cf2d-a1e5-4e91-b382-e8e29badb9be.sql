-- v13.823.60 (fix) · crm_calificar_prospecto: el operador `||` con literales sin
-- tipo hacía que Postgres intentara leer 'sector' como literal de arreglo
-- ("malformed array literal") en lugar de agregar el campo faltante.
-- Forward-only: se recrea la función con los literales tipados a text.
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
    v_faltantes := v_faltantes || 'sector'::text;
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.mercancia, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'mercancia'::text;
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.rutas, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'rutas'::text;
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.volumen, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'volumen'::text;
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.frecuencia, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'frecuencia'::text;
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.dolor_explicito, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'dolor_explicito'::text;
  END IF;
  IF NULLIF(TRIM(COALESCE(v_lead.proveedor_actual, '')), '') IS NULL THEN
    v_faltantes := v_faltantes || 'proveedor_actual'::text;
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

REVOKE ALL ON FUNCTION public.crm_calificar_prospecto(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_calificar_prospecto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_calificar_prospecto(uuid) TO service_role;