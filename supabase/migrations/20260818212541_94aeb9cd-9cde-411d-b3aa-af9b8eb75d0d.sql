-- ============================================================
-- A) Datos fiscales del prospecto en el lead (captura única)
-- ============================================================
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS rfc text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS direccion text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cp text NOT NULL DEFAULT '';

-- ============================================================
-- B) Núcleo transaccional del vínculo cotización <-> oportunidad
-- ============================================================
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

  -- Idempotencia: ya está ligada.
  IF v_op_existente IS NOT NULL THEN
    SELECT lead_id INTO v_lead_id FROM public.crm_oportunidades WHERE id = v_op_existente;
    RETURN jsonb_build_object(
      'oportunidad_id', v_op_existente, 'lead_id', v_lead_id,
      'creado_lead', false, 'creado_oportunidad', false, 'ya_ligada', true
    );
  END IF;

  v_empresa := NULLIF(btrim(COALESCE(p_prospecto->>'empresa', '')), '');
  v_email := NULLIF(lower(btrim(COALESCE(p_prospecto->>'email', ''))), '');

  -- Caso A: oportunidad indicada explícitamente (debe ser del mismo tenant).
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

  -- Etapa destino: prioriza una etapa abierta cuyo nombre contenga "cotiz".
  SELECT id, probabilidad_default INTO v_etapa_id, v_etapa_prob
  FROM public.crm_etapas_pipeline
  WHERE organization_id = v_org AND activa = true AND tipo = 'abierta'::crm_etapa_tipo
  ORDER BY (nombre ILIKE '%cotiz%') DESC, orden ASC
  LIMIT 1;

  IF v_etapa_id IS NULL THEN
    RAISE EXCEPTION 'LC_CRM_SIN_ETAPA_ABIERTA: configura al menos una etapa abierta en el pipeline';
  END IF;

  -- Lead: explícito > dedupe por email > dedupe por empresa normalizada > nuevo.
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
      rfc, direccion, ciudad, estado, cp, pais,
      interes_modo, estado_lead_placeholder
    )
    SELECT
      v_org, v_empresa,
      COALESCE(p_prospecto->>'contacto', ''),
      COALESCE(v_email, ''),
      COALESCE(p_prospecto->>'telefono', ''),
      COALESCE(p_prospecto->>'rfc', ''),
      COALESCE(p_prospecto->>'direccion', ''),
      COALESCE(p_prospecto->>'ciudad', ''),
      COALESCE(p_prospecto->>'estado', ''),
      COALESCE(p_prospecto->>'cp', ''),
      COALESCE(p_prospecto->>'pais', ''),
      COALESCE(v_modo, ''),
      NULL
    RETURNING id INTO v_lead_id;
    v_creado_lead := true;
  ELSE
    -- Enriquecer el lead existente con datos fiscales nuevos sin borrar los previos.
    UPDATE public.crm_leads l
       SET rfc = CASE WHEN btrim(l.rfc) = '' THEN COALESCE(p_prospecto->>'rfc', '') ELSE l.rfc END,
           direccion = CASE WHEN btrim(l.direccion) = '' THEN COALESCE(p_prospecto->>'direccion', '') ELSE l.direccion END,
           cp = CASE WHEN btrim(l.cp) = '' THEN COALESCE(p_prospecto->>'cp', '') ELSE l.cp END,
           ciudad = CASE WHEN btrim(l.ciudad) = '' THEN COALESCE(p_prospecto->>'ciudad', '') ELSE l.ciudad END,
           estado = CASE WHEN btrim(COALESCE(l.estado, '')) = '' THEN COALESCE(p_prospecto->>'estado', '') ELSE l.estado END,
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

-- RPC pública con validación de tenant y permisos
CREATE OR REPLACE FUNCTION public.crm_vincular_cotizacion(
  p_cotizacion_id uuid,
  p_prospecto jsonb DEFAULT '{}'::jsonb,
  p_lead_id uuid DEFAULT NULL,
  p_oportunidad_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_email text;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.cotizaciones WHERE id = p_cotizacion_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ENCONTRADA: la cotización no existe';
  END IF;
  IF NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA: la cotización pertenece a otra organización';
  END IF;
  IF NOT public.rls_tenant_scope_ok(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA: la cotización pertenece a otra organización';
  END IF;
  IF NOT public.puede_escribir_cotizaciones() THEN
    RAISE EXCEPTION 'LC_COTIZACION_SIN_PERMISO_ESCRITURA: tu rol no puede modificar cotizaciones';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  RETURN public._crm_vincular_cotizacion_core(
    p_cotizacion_id, COALESCE(p_prospecto, '{}'::jsonb), p_lead_id, p_oportunidad_id,
    v_email, auth.uid()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_vincular_cotizacion(uuid, jsonb, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_vincular_cotizacion(uuid, jsonb, uuid, uuid) TO authenticated, service_role;

-- ============================================================
-- C) Guard: no enviar cotización de prospecto sin oportunidad
-- ============================================================
CREATE OR REPLACE FUNCTION public._cotizaciones_bloquear_envio_sin_oportunidad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estado IN ('Enviada'::estado_cotizacion, 'Solicitada'::estado_cotizacion)
     AND COALESCE(OLD.estado, 'Borrador'::estado_cotizacion) <> NEW.estado
     AND COALESCE(NEW.es_prospecto, false) = true
     AND NEW.oportunidad_id IS NULL
  THEN
    RAISE EXCEPTION 'LC_COT_SIN_OPORTUNIDAD: liga la cotización a una oportunidad del CRM antes de enviarla'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cotizaciones_envio_sin_oportunidad ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_envio_sin_oportunidad
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public._cotizaciones_bloquear_envio_sin_oportunidad();

-- ============================================================
-- D) Backfill de cotizaciones huérfanas (sólo procesos del sistema)
-- ============================================================
CREATE OR REPLACE FUNCTION public.crm_backfill_cotizaciones_sin_oportunidad()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_ok integer := 0;
  v_fail integer := 0;
  v_errores jsonb := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT id, prospecto_empresa, prospecto_contacto, prospecto_email, prospecto_telefono, cliente_nombre
    FROM public.cotizaciones
    WHERE es_prospecto = true AND oportunidad_id IS NULL AND deleted_at IS NULL
    ORDER BY created_at ASC
  LOOP
    BEGIN
      PERFORM public._crm_vincular_cotizacion_core(
        r.id,
        jsonb_build_object(
          'empresa', COALESCE(NULLIF(btrim(r.prospecto_empresa), ''), NULLIF(btrim(r.cliente_nombre), '')),
          'contacto', COALESCE(r.prospecto_contacto, ''),
          'email', COALESCE(r.prospecto_email, ''),
          'telefono', COALESCE(r.prospecto_telefono, '')
        ),
        NULL, NULL, NULL, NULL
      );
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      v_errores := v_errores || jsonb_build_object('cotizacion_id', r.id, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('ligadas', v_ok, 'fallidas', v_fail, 'errores', v_errores);
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_backfill_cotizaciones_sin_oportunidad() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_backfill_cotizaciones_sin_oportunidad() TO service_role;

-- ============================================================
-- E) Conversión prospecto -> cliente propaga al CRM en la misma transacción
-- ============================================================
CREATE OR REPLACE FUNCTION public.convertir_prospecto_a_cliente_rpc(p_cotizacion_id uuid, p_cliente jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_es_prospecto boolean;
  v_cliente_id uuid;
  v_nombre text;
  v_rfc text;
  v_creado boolean := false;
  v_oportunidad_id uuid;
  v_lead_id uuid;
BEGIN
  SELECT organization_id, es_prospecto, cliente_id, oportunidad_id
    INTO v_org, v_es_prospecto, v_cliente_id, v_oportunidad_id
  FROM public.cotizaciones WHERE id = p_cotizacion_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  -- Idempotencia: si ya se convirtió, devolver el cliente existente.
  IF v_cliente_id IS NOT NULL AND COALESCE(v_es_prospecto, false) = false THEN
    SELECT nombre INTO v_nombre FROM public.clientes WHERE id = v_cliente_id;
    RETURN jsonb_build_object('cliente_id', v_cliente_id, 'nombre', v_nombre, 'creado', false);
  END IF;

  v_nombre := NULLIF(btrim(COALESCE(p_cliente->>'nombre', '')), '');
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'LC_CLIENTE_SIN_NOMBRE';
  END IF;
  v_rfc := NULLIF(btrim(upper(COALESCE(p_cliente->>'rfc', ''))), '');

  -- Reutiliza cliente existente con el mismo RFC dentro de la organización.
  -- RG2: los RFC genéricos del SAT (XAXX010101000 público en general,
  -- XEXX010101000 extranjeros) no identifican a nadie: nunca matchean.
  IF v_rfc IS NOT NULL AND v_rfc NOT IN ('XAXX010101000', 'XEXX010101000') THEN
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE organization_id = v_org AND upper(btrim(rfc)) = v_rfc AND deleted_at IS NULL
      AND upper(btrim(rfc)) NOT IN ('XAXX010101000', 'XEXX010101000')
    LIMIT 1;
  ELSE
    v_cliente_id := NULL;
  END IF;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (
      organization_id, nombre, contacto, email, telefono, rfc, direccion, ciudad, estado, cp
    ) VALUES (
      v_org,
      v_nombre,
      COALESCE(p_cliente->>'contacto', ''),
      COALESCE(p_cliente->>'email', ''),
      COALESCE(p_cliente->>'telefono', ''),
      COALESCE(v_rfc, ''),
      COALESCE(p_cliente->>'direccion', ''),
      COALESCE(p_cliente->>'ciudad', ''),
      COALESCE(p_cliente->>'estado', ''),
      COALESCE(p_cliente->>'cp', '')
    )
    RETURNING id INTO v_cliente_id;
    v_creado := true;
  END IF;

  UPDATE public.cotizaciones
     SET cliente_id = v_cliente_id,
         cliente_nombre = v_nombre,
         es_prospecto = false,
         updated_at = now()
   WHERE id = p_cotizacion_id;

  -- Propagación CRM atómica: oportunidad y lead quedan ligados al cliente.
  IF v_oportunidad_id IS NOT NULL THEN
    UPDATE public.crm_oportunidades
       SET cliente_id = v_cliente_id,
           cliente_nombre = v_nombre,
           updated_at = now()
     WHERE id = v_oportunidad_id AND organization_id = v_org
    RETURNING lead_id INTO v_lead_id;

    IF v_lead_id IS NOT NULL THEN
      UPDATE public.crm_leads
         SET estado = 'Convertido'::crm_lead_estado,
             cliente_convertido_id = v_cliente_id,
             oportunidad_convertida_id = v_oportunidad_id,
             updated_at = now()
       WHERE id = v_lead_id AND organization_id = v_org;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'cliente_id', v_cliente_id, 'nombre', v_nombre, 'creado', v_creado,
    'oportunidad_id', v_oportunidad_id, 'lead_id', v_lead_id
  );
END;
$function$;