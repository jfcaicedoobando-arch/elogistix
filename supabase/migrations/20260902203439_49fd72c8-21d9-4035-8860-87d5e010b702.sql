-- v13.823.54 — Lote DB/seguridad YAGNI: cierre de relaciones cross-org del CRM
-- y autorización real de public.convertir_lead_rpc.
-- Preflight read-only: 1 fila legada en crm_oportunidades (773d11e8-b066-4230-a25e-b2ce420cc8f1),
-- ya soft-deleted, apuntando a un prospecto soft-deleted de la MISMA organización.
-- No se corrige ni se borra. 0 referencias cross-org/inexistentes en el resto.
-- Forward-only e idempotente. NO corrige datos.

CREATE OR REPLACE FUNCTION public.convertir_lead_rpc(
  p_lead_id uuid,
  p_crear_cliente boolean,
  p_cliente_id uuid,
  p_nombre_oportunidad text,
  p_monto_estimado numeric,
  p_moneda text,
  p_fecha_estimada_cierre date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead public.crm_leads;
  v_cliente_id uuid;
  v_cliente_nombre text := '';
  v_etapa_id uuid;
  v_prob integer;
  v_op_id uuid;
  v_email_actual text;
  v_uid uuid := auth.uid();
  v_rol public.app_role;
BEGIN
  IF v_uid IS NULL AND current_user <> 'service_role' THEN
    RAISE EXCEPTION 'LC_SESION_REQUERIDA: inicia sesión para convertir prospectos';
  END IF;

  SELECT * INTO v_lead FROM public.crm_leads
   WHERE id = p_lead_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'LC_LEAD_NO_ENCONTRADO';
  END IF;

  IF v_uid IS NOT NULL THEN
    IF NOT public.is_org_member(v_lead.organization_id) THEN
      RAISE EXCEPTION 'LC_ORG_AJENA';
    END IF;

    v_rol := public.rol_efectivo(v_uid, v_lead.organization_id);

    IF v_rol IN (
      'admin'::public.app_role,
      'admin_org'::public.app_role,
      'super_admin'::public.app_role,
      'gerente_comercial'::public.app_role,
      'operador'::public.app_role
    ) THEN
      NULL;
    ELSIF v_rol = 'vendedor'::public.app_role THEN
      IF v_lead.vendedor_id IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'LC_LEAD_AJENO: sólo puedes convertir prospectos asignados a ti';
      END IF;
    ELSE
      RAISE EXCEPTION 'LC_ROL_SIN_PERMISO_CRM: tu rol no puede convertir prospectos';
    END IF;
  END IF;

  IF v_lead.estado = 'Convertido'::crm_lead_estado AND v_lead.oportunidad_convertida_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'cliente_id', v_lead.cliente_convertido_id,
      'oportunidad_id', v_lead.oportunidad_convertida_id,
      'creado', false
    );
  END IF;

  IF NULLIF(btrim(COALESCE(p_nombre_oportunidad, '')), '') IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_SIN_NOMBRE';
  END IF;

  IF COALESCE(p_crear_cliente, false) AND p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'LC_LEAD_ALTA_CLIENTE_PROHIBIDA';
  END IF;

  IF p_cliente_id IS NOT NULL THEN
    SELECT id, nombre INTO v_cliente_id, v_cliente_nombre
    FROM public.clientes
    WHERE id = p_cliente_id AND organization_id = v_lead.organization_id AND deleted_at IS NULL;
    IF v_cliente_id IS NULL THEN
      RAISE EXCEPTION 'LC_CLIENTE_NO_ENCONTRADO';
    END IF;
  END IF;

  SELECT id, COALESCE(probabilidad_default, 0) INTO v_etapa_id, v_prob
  FROM public.crm_etapas_pipeline
  WHERE tipo = 'abierta' AND activa = true AND organization_id = v_lead.organization_id
  ORDER BY orden ASC
  LIMIT 1;
  IF v_etapa_id IS NULL THEN
    RAISE EXCEPTION 'LC_PIPELINE_SIN_ETAPAS';
  END IF;

  SELECT email INTO v_email_actual FROM auth.users WHERE id = v_uid;

  INSERT INTO public.crm_oportunidades (
    organization_id, nombre, lead_id, cliente_id, cliente_nombre, etapa_id, probabilidad,
    monto_estimado, moneda, fecha_estimada_cierre, vendedor_id, vendedor_email, modo,
    sector, origen, destino, created_by
  ) VALUES (
    v_lead.organization_id,
    btrim(p_nombre_oportunidad),
    v_lead.id,
    v_cliente_id,
    COALESCE(v_cliente_nombre, ''),
    v_etapa_id,
    v_prob,
    COALESCE(p_monto_estimado, 0),
    COALESCE(NULLIF(p_moneda, ''), 'MXN'),
    p_fecha_estimada_cierre,
    COALESCE(v_lead.vendedor_id, v_uid),
    COALESCE(NULLIF(btrim(COALESCE(v_lead.vendedor_email, '')), ''), v_email_actual, ''),
    COALESCE(v_lead.interes_modo, ''),
    v_lead.sector,
    COALESCE(v_lead.origen, ''),
    COALESCE(v_lead.destino, ''),
    v_uid
  )
  RETURNING id INTO v_op_id;

  UPDATE public.crm_leads
     SET estado = 'Convertido'::crm_lead_estado,
         cliente_convertido_id = v_cliente_id,
         oportunidad_convertida_id = v_op_id,
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN jsonb_build_object('cliente_id', v_cliente_id, 'oportunidad_id', v_op_id, 'creado', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._crm_oportunidad_requiere_origen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_org uuid;
  v_lead_estado public.crm_lead_estado;
  v_cliente_org uuid;
BEGIN
  IF NEW.lead_id IS NULL AND NEW.cliente_id IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_SIN_ORIGEN';
  END IF;

  IF NEW.lead_id IS NOT NULL THEN
    SELECT organization_id, estado INTO v_lead_org, v_lead_estado
      FROM public.crm_leads
     WHERE id = NEW.lead_id
       AND organization_id = NEW.organization_id
       AND deleted_at IS NULL;
    IF v_lead_org IS NULL OR v_lead_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_CRM_LEAD_AJENO';
    END IF;
    IF v_lead_estado IN (
      'Nuevo'::public.crm_lead_estado,
      'Contactado'::public.crm_lead_estado,
      'Descalificado'::public.crm_lead_estado
    ) THEN
      RAISE EXCEPTION 'LC_OPORTUNIDAD_ORIGEN_NO_CALIFICADO';
    END IF;
  END IF;

  IF NEW.cliente_id IS NOT NULL THEN
    SELECT organization_id INTO v_cliente_org
      FROM public.clientes
     WHERE id = NEW.cliente_id
       AND organization_id = NEW.organization_id
       AND deleted_at IS NULL;
    IF v_cliente_org IS NULL OR v_cliente_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_CRM_CLIENTE_AJENO';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._crm_oportunidad_requiere_origen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_oportunidad_requiere_origen() TO service_role;

DROP TRIGGER IF EXISTS trg_crm_oportunidad_requiere_origen ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_oportunidad_requiere_origen
BEFORE INSERT OR UPDATE OF lead_id, cliente_id, organization_id ON public.crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public._crm_oportunidad_requiere_origen();

CREATE OR REPLACE FUNCTION public._crm_criterio_etapa_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_etapas_pipeline e
     WHERE e.id = NEW.etapa_id
       AND e.organization_id = NEW.organization_id
       AND e.deleted_at IS NULL
       AND e.activa
  ) THEN
    RAISE EXCEPTION 'LC_ETAPA_AJENA: la etapa no existe, está inactiva o pertenece a otra organización';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._crm_criterio_etapa_misma_org() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_criterio_etapa_misma_org() TO service_role;

DROP TRIGGER IF EXISTS trg_crm_criterio_etapa_misma_org ON public.crm_etapa_criterios;
CREATE TRIGGER trg_crm_criterio_etapa_misma_org
BEFORE INSERT OR UPDATE OF etapa_id, organization_id ON public.crm_etapa_criterios
FOR EACH ROW EXECUTE FUNCTION public._crm_criterio_etapa_misma_org();

CREATE OR REPLACE FUNCTION public._crm_cumplimiento_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_oportunidades o
     WHERE o.id = NEW.oportunidad_id
       AND o.organization_id = NEW.organization_id
       AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_AJENA: la oportunidad no existe, está eliminada o pertenece a otra organización';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.crm_etapa_criterios c
     WHERE c.id = NEW.criterio_id
       AND c.organization_id = NEW.organization_id
       AND c.deleted_at IS NULL
       AND c.activo
  ) THEN
    RAISE EXCEPTION 'LC_CRITERIO_AJENO: el criterio no existe, está inactivo o pertenece a otra organización';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._crm_cumplimiento_misma_org() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_cumplimiento_misma_org() TO service_role;

DROP TRIGGER IF EXISTS trg_crm_cumplimiento_misma_org ON public.crm_oportunidad_criterios;
CREATE TRIGGER trg_crm_cumplimiento_misma_org
BEFORE INSERT OR UPDATE OF oportunidad_id, criterio_id, organization_id ON public.crm_oportunidad_criterios
FOR EACH ROW EXECUTE FUNCTION public._crm_cumplimiento_misma_org();

CREATE OR REPLACE FUNCTION public._crm_comentario_oportunidad_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_oportunidades o
     WHERE o.id = NEW.oportunidad_id
       AND o.organization_id = NEW.organization_id
       AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_AJENA: la oportunidad no existe, está eliminada o pertenece a otra organización';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._crm_comentario_oportunidad_misma_org() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_comentario_oportunidad_misma_org() TO service_role;

DROP TRIGGER IF EXISTS trg_crm_comentario_misma_org ON public.crm_comentarios_oportunidad;
CREATE TRIGGER trg_crm_comentario_misma_org
BEFORE INSERT OR UPDATE OF oportunidad_id, organization_id ON public.crm_comentarios_oportunidad
FOR EACH ROW EXECUTE FUNCTION public._crm_comentario_oportunidad_misma_org();

CREATE OR REPLACE FUNCTION public.crm_notify_comentario_oportunidad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vendedor_id uuid;
  v_op_nombre text;
BEGIN
  SELECT vendedor_id, nombre
    INTO v_vendedor_id, v_op_nombre
    FROM public.crm_oportunidades
   WHERE id = NEW.oportunidad_id
     AND organization_id = NEW.organization_id
     AND deleted_at IS NULL;

  IF v_vendedor_id IS NOT NULL AND v_vendedor_id <> NEW.autor_id THEN
    INSERT INTO public.crm_notificaciones (
      organization_id, user_id, tipo, titulo, mensaje, link
    ) VALUES (
      NEW.organization_id,
      v_vendedor_id,
      'comentario_oportunidad',
      'Nuevo comentario en oportunidad',
      COALESCE(NEW.autor_email, 'Alguien') || ' comentó en "' || COALESCE(v_op_nombre, 'oportunidad') || '"',
      '/crm/oportunidades/' || NEW.oportunidad_id::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_notify_comentario_oportunidad() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_notify_comentario_oportunidad() TO service_role;