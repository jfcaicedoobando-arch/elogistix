ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS entidad_federativa text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public._crm_vincular_cotizacion_core(
  p_cotizacion_id uuid,
  p_prospecto jsonb DEFAULT '{}'::jsonb,
  p_lead_id uuid DEFAULT NULL,
  p_oportunidad_id uuid DEFAULT NULL,
  p_actor_email text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
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
  v_op_existente uuid;
  v_etapa_id uuid;
  v_etapa_prob integer;
  v_lead_id uuid := NULL;
  v_op_id uuid;
  v_empresa text;
  v_email text;
  v_empresa_norm text;
  v_creado_lead boolean := false;
BEGIN
  SELECT organization_id, folio, modo, oportunidad_id
    INTO v_org, v_folio, v_modo, v_op_existente
  FROM public.cotizaciones
  WHERE id = p_cotizacion_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ENCONTRADA: la cotización no existe';
  END IF;

  IF v_op_existente IS NOT NULL THEN
    SELECT lead_id INTO v_lead_id FROM public.crm_oportunidades WHERE id = v_op_existente;
    RETURN jsonb_build_object(
      'oportunidad_id', v_op_existente, 'lead_id', v_lead_id,
      'creado_lead', false, 'creado_oportunidad', false, 'ya_ligada', true
    );
  END IF;

  v_empresa := NULLIF(btrim(COALESCE(p_prospecto->>'empresa', '')), '');
  v_email := NULLIF(lower(btrim(COALESCE(p_prospecto->>'email', ''))), '');

  IF p_oportunidad_id IS NOT NULL THEN
    SELECT id, lead_id INTO v_op_id, v_lead_id
    FROM public.crm_oportunidades
    WHERE id = p_oportunidad_id AND organization_id = v_org AND deleted_at IS NULL;
    IF v_op_id IS NULL THEN
      RAISE EXCEPTION 'LC_CRM_OPORTUNIDAD_AJENA: la oportunidad no pertenece a la organización';
    END IF;
    UPDATE public.cotizaciones
       SET oportunidad_id = v_op_id, updated_at = now()
     WHERE id = p_cotizacion_id;
    RETURN jsonb_build_object(
      'oportunidad_id', v_op_id, 'lead_id', v_lead_id,
      'creado_lead', false, 'creado_oportunidad', false, 'ya_ligada', false
    );
  END IF;

  SELECT id, probabilidad_default INTO v_etapa_id, v_etapa_prob
  FROM public.crm_etapas_pipeline
  WHERE organization_id = v_org AND activa = true AND tipo = 'abierta'::crm_etapa_tipo
  ORDER BY (nombre ILIKE '%cotiz%') DESC, orden ASC
  LIMIT 1;

  IF v_etapa_id IS NULL THEN
    RAISE EXCEPTION 'LC_CRM_SIN_ETAPA_ABIERTA: configura al menos una etapa abierta en el pipeline';
  END IF;

  IF p_lead_id IS NOT NULL THEN
    SELECT id INTO v_lead_id
    FROM public.crm_leads
    WHERE id = p_lead_id AND organization_id = v_org AND deleted_at IS NULL;
    IF v_lead_id IS NULL THEN
      RAISE EXCEPTION 'LC_CRM_LEAD_AJENO: el prospecto no pertenece a la organización';
    END IF;
  END IF;

  IF v_lead_id IS NULL AND v_email IS NOT NULL THEN
    SELECT id INTO v_lead_id
    FROM public.crm_leads
    WHERE organization_id = v_org AND deleted_at IS NULL
      AND lower(btrim(email)) = v_email
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL AND v_empresa IS NOT NULL THEN
    v_empresa_norm := upper(regexp_replace(btrim(v_empresa), '\s+', ' ', 'g'));
    SELECT id INTO v_lead_id
    FROM public.crm_leads
    WHERE organization_id = v_org AND deleted_at IS NULL
      AND upper(regexp_replace(btrim(empresa), '\s+', ' ', 'g')) = v_empresa_norm
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    IF v_empresa IS NULL THEN
      RAISE EXCEPTION 'LC_CRM_PROSPECTO_SIN_EMPRESA: captura el nombre de la empresa del prospecto';
    END IF;
    INSERT INTO public.crm_leads (
      organization_id, empresa, contacto, email, telefono,
      rfc, direccion, ciudad, entidad_federativa, cp, pais, interes_modo
    ) VALUES (
      v_org, v_empresa,
      COALESCE(p_prospecto->>'contacto', ''),
      COALESCE(v_email, ''),
      COALESCE(p_prospecto->>'telefono', ''),
      COALESCE(p_prospecto->>'rfc', ''),
      COALESCE(p_prospecto->>'direccion', ''),
      COALESCE(p_prospecto->>'ciudad', ''),
      COALESCE(p_prospecto->>'entidad_federativa', ''),
      COALESCE(p_prospecto->>'cp', ''),
      COALESCE(p_prospecto->>'pais', ''),
      COALESCE(v_modo, '')
    )
    RETURNING id INTO v_lead_id;
    v_creado_lead := true;
  ELSE
    UPDATE public.crm_leads l
       SET rfc = CASE WHEN btrim(l.rfc) = '' THEN COALESCE(p_prospecto->>'rfc', '') ELSE l.rfc END,
           direccion = CASE WHEN btrim(l.direccion) = '' THEN COALESCE(p_prospecto->>'direccion', '') ELSE l.direccion END,
           cp = CASE WHEN btrim(l.cp) = '' THEN COALESCE(p_prospecto->>'cp', '') ELSE l.cp END,
           ciudad = CASE WHEN btrim(l.ciudad) = '' THEN COALESCE(p_prospecto->>'ciudad', '') ELSE l.ciudad END,
           entidad_federativa = CASE WHEN btrim(l.entidad_federativa) = '' THEN COALESCE(p_prospecto->>'entidad_federativa', '') ELSE l.entidad_federativa END,
           telefono = CASE WHEN btrim(l.telefono) = '' THEN COALESCE(p_prospecto->>'telefono', '') ELSE l.telefono END,
           email = CASE WHEN btrim(l.email) = '' THEN COALESCE(v_email, '') ELSE l.email END,
           updated_at = now()
     WHERE l.id = v_lead_id;
  END IF;

  INSERT INTO public.crm_oportunidades (
    organization_id, nombre, cliente_nombre, lead_id, etapa_id, probabilidad, modo,
    vendedor_id, vendedor_email
  ) VALUES (
    v_org,
    CASE WHEN v_folio IS NOT NULL AND btrim(v_folio) <> ''
         THEN COALESCE(v_empresa, 'Prospecto') || ' — ' || v_folio
         ELSE 'Cotización · ' || COALESCE(v_empresa, 'Prospecto') END,
    COALESCE(v_empresa, ''),
    v_lead_id,
    v_etapa_id,
    COALESCE(v_etapa_prob, 30),
    COALESCE(v_modo, ''),
    p_actor_id,
    COALESCE(p_actor_email, '')
  )
  RETURNING id INTO v_op_id;

  UPDATE public.cotizaciones
     SET oportunidad_id = v_op_id, updated_at = now()
   WHERE id = p_cotizacion_id;

  RETURN jsonb_build_object(
    'oportunidad_id', v_op_id, 'lead_id', v_lead_id,
    'creado_lead', v_creado_lead, 'creado_oportunidad', true, 'ya_ligada', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._crm_vincular_cotizacion_core(uuid, jsonb, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_vincular_cotizacion_core(uuid, jsonb, uuid, uuid, text, uuid) TO service_role;