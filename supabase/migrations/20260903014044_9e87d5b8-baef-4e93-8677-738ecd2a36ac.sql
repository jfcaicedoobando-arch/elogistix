CREATE OR REPLACE FUNCTION public.crm_vincular_cotizacion(
  p_cotizacion_id uuid,
  p_prospecto jsonb DEFAULT '{}'::jsonb,
  p_lead_id uuid DEFAULT NULL::uuid,
  p_oportunidad_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_folio text;
  v_modo text;
  v_cliente_id uuid;
  v_es_prospecto boolean;
  v_op_existente uuid;
  v_op_id uuid;
  v_lead_id uuid;
  v_lead_existente uuid;
  v_lead_empresa text;
  v_etapa_id uuid;
  v_etapa_prob integer;
  v_creada boolean := false;
  v_updated_at timestamptz;
  v_actor_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_SESION: se requiere sesión activa' USING ERRCODE = '42501';
  END IF;

  IF p_lead_id IS NULL AND p_oportunidad_id IS NULL THEN
    RAISE EXCEPTION 'LC_COT_VINCULO_SIN_ORIGEN' USING ERRCODE = '22023';
  END IF;

  SELECT organization_id, folio, modo, cliente_id, COALESCE(es_prospecto, false), oportunidad_id
    INTO v_org, v_folio, v_modo, v_cliente_id, v_es_prospecto, v_op_existente
  FROM public.cotizaciones
  WHERE id = p_cotizacion_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ENCONTRADA: la cotización no existe';
  END IF;

  IF NOT public.is_org_member(v_org)
     OR NOT public.rls_tenant_scope_ok(v_org)
     OR NOT public.puede_escribir_cotizaciones() THEN
    RAISE EXCEPTION 'LC_COTIZACION_SIN_PERMISO_ESCRITURA' USING ERRCODE = '42501';
  END IF;

  IF v_cliente_id IS NOT NULL OR v_es_prospecto = false THEN
    RAISE EXCEPTION 'LC_COT_PROSPECTO_CON_CLIENTE' USING ERRCODE = '22023';
  END IF;

  -- ── Idempotencia histórica ANTES de la elegibilidad nueva ────────────────
  IF v_op_existente IS NOT NULL THEN
    SELECT o.id, o.lead_id
      INTO v_op_id, v_lead_existente
    FROM public.crm_oportunidades o
    WHERE o.id = v_op_existente
      AND o.organization_id = v_org
      AND o.deleted_at IS NULL
    FOR UPDATE OF o;

    IF v_op_id IS NULL THEN
      RAISE EXCEPTION 'LC_COT_VINCULO_ROTO' USING ERRCODE = '22023';
    END IF;

    IF NOT (
      (p_oportunidad_id = v_op_existente
        AND (p_lead_id IS NULL OR p_lead_id = v_lead_existente))
      OR (p_oportunidad_id IS NULL
        AND p_lead_id IS NOT NULL AND p_lead_id = v_lead_existente)
    ) THEN
      RAISE EXCEPTION 'LC_COT_VINCULO_CONFIRMADO' USING ERRCODE = '22023';
    END IF;

    SELECT updated_at INTO v_updated_at FROM public.cotizaciones WHERE id = p_cotizacion_id;
    RETURN jsonb_build_object(
      'oportunidad_id', v_op_id, 'lead_id', v_lead_existente,
      'creado_lead', false, 'creado_oportunidad', false, 'ya_ligada', true,
      'updated_at', v_updated_at
    );
  END IF;

  -- ── Vínculo NUEVO: elegibilidad estricta ────────────────────────────────
  IF p_oportunidad_id IS NOT NULL THEN
    SELECT o.id, o.lead_id
      INTO v_op_id, v_lead_id
    FROM public.crm_oportunidades o
    JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
    WHERE o.id = p_oportunidad_id
      AND o.organization_id = v_org
      AND o.deleted_at IS NULL
      AND o.cliente_id IS NULL
      AND e.organization_id = v_org
      AND e.deleted_at IS NULL
      AND e.activa = true
      AND e.tipo = 'abierta'::crm_etapa_tipo
    FOR UPDATE OF o;

    IF v_op_id IS NULL THEN
      RAISE EXCEPTION 'LC_CRM_OPORTUNIDAD_NO_ELEGIBLE' USING ERRCODE = '22023';
    END IF;

    IF p_lead_id IS NOT NULL AND v_lead_id IS DISTINCT FROM p_lead_id THEN
      RAISE EXCEPTION 'LC_CRM_OPORTUNIDAD_NO_ELEGIBLE' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_lead_id := p_lead_id;
  END IF;

  SELECT l.empresa INTO v_lead_empresa
  FROM public.crm_leads l
  WHERE l.id = v_lead_id
    AND l.organization_id = v_org
    AND l.deleted_at IS NULL
    AND l.estado IN ('Calificado'::crm_lead_estado, 'Prospecto'::crm_lead_estado)
  FOR UPDATE;

  IF v_lead_empresa IS NULL THEN
    RAISE EXCEPTION 'LC_CRM_LEAD_NO_ELEGIBLE' USING ERRCODE = '22023';
  END IF;

  IF v_op_id IS NULL THEN
    SELECT o.id INTO v_op_id
    FROM public.crm_oportunidades o
    JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
    WHERE o.organization_id = v_org
      AND o.lead_id = v_lead_id
      AND o.deleted_at IS NULL
      AND o.cliente_id IS NULL
      AND e.organization_id = v_org
      AND e.deleted_at IS NULL
      AND e.activa = true
      AND e.tipo = 'abierta'::crm_etapa_tipo
    ORDER BY o.created_at ASC
    LIMIT 1
    FOR UPDATE OF o;

    IF v_op_id IS NULL THEN
      SELECT id, probabilidad_default INTO v_etapa_id, v_etapa_prob
      FROM public.crm_etapas_pipeline
      WHERE organization_id = v_org
        AND deleted_at IS NULL
        AND activa = true
        AND tipo = 'abierta'::crm_etapa_tipo
      ORDER BY (nombre ILIKE '%cotiz%') DESC, orden ASC
      LIMIT 1;

      IF v_etapa_id IS NULL THEN
        RAISE EXCEPTION 'LC_CRM_SIN_ETAPA_ABIERTA: configura al menos una etapa abierta en el pipeline';
      END IF;

      SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();

      INSERT INTO public.crm_oportunidades (
        organization_id, nombre, cliente_nombre, lead_id, etapa_id, probabilidad, modo,
        vendedor_id, vendedor_email
      ) VALUES (
        v_org,
        CASE WHEN v_folio IS NOT NULL AND btrim(v_folio) <> ''
             THEN v_lead_empresa || ' — ' || v_folio
             ELSE 'Cotización · ' || v_lead_empresa END,
        v_lead_empresa,
        v_lead_id,
        v_etapa_id,
        COALESCE(v_etapa_prob, 30),
        COALESCE(v_modo, ''),
        auth.uid(),
        COALESCE(v_actor_email, '')
      )
      RETURNING id INTO v_op_id;
      v_creada := true;
    END IF;
  END IF;

  UPDATE public.cotizaciones
     SET oportunidad_id = v_op_id, updated_at = now()
   WHERE id = p_cotizacion_id
  RETURNING updated_at INTO v_updated_at;

  RETURN jsonb_build_object(
    'oportunidad_id', v_op_id, 'lead_id', v_lead_id,
    'creado_lead', false, 'creado_oportunidad', v_creada, 'ya_ligada', false,
    'updated_at', v_updated_at
  );
END;
$function$;

ALTER FUNCTION public.crm_vincular_cotizacion(uuid, jsonb, uuid, uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.crm_vincular_cotizacion(uuid, jsonb, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_vincular_cotizacion(uuid, jsonb, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_vincular_cotizacion(uuid, jsonb, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_vincular_cotizacion(uuid, jsonb, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.crm_vincular_cotizacion(uuid, jsonb, uuid, uuid) IS
  'Vincula una cotización de prospecto a una oportunidad CRM. Idempotencia histórica primero: si la cotización ya está vinculada y el origen solicitado coincide, devuelve ya_ligada=true sin exigir etapa abierta ni estado del lead (vínculo roto = LC_COT_VINCULO_ROTO; origen distinto = LC_COT_VINCULO_CONFIRMADO). Sólo el vínculo NUEVO exige elegibilidad estricta (etapa same-org viva activa abierta, lead vivo same-org Calificado/Prospecto bloqueado). Nunca crea ni deduplica leads: p_prospecto se ignora. Devuelve updated_at para resincronizar el bloqueo optimista del wizard.';