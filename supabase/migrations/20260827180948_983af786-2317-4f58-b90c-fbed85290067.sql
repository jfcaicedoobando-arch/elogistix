-- ─────────────────────────────────────────────────────────────────────────────
-- Rediseño CRM · Etapa 1: puerta de calificación Lead → Prospecto
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) RPC de calificación (SECURITY DEFINER, candado multi-tenant + rol ventas).
CREATE OR REPLACE FUNCTION public.crm_calificar_prospecto(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead public.crm_leads;
  v_email text;
  v_faltantes text[] := ARRAY[]::text[];
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

  IF NOT public.is_org_member(v_lead.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  IF NOT public.has_role(auth.uid(), 'vendedor'::public.app_role) THEN
    RAISE EXCEPTION 'LC_LEAD_SIN_PERMISO_CALIFICAR';
  END IF;

  IF v_lead.estado::text IN ('Descalificado', 'Convertido') THEN
    RAISE EXCEPTION 'LC_LEAD_ESTADO_NO_CALIFICABLE';
  END IF;

  -- Idempotente: recalificar un prospecto no es error (doble click / retry).
  IF v_lead.estado::text IN ('Prospecto', 'Pendiente de alta') THEN
    RETURN jsonb_build_object(
      'lead_id', v_lead.id,
      'estado', v_lead.estado,
      'calificado', false
    );
  END IF;

  -- Perfil comercial mínimo (ICP) para poder cotizar.
  IF COALESCE(NULLIF(TRIM(v_lead.sector), ''), NULL) IS NULL THEN
    v_faltantes := v_faltantes || 'sector';
  END IF;
  IF COALESCE(NULLIF(TRIM(v_lead.mercancia), ''), NULL) IS NULL THEN
    v_faltantes := v_faltantes || 'mercancia';
  END IF;
  IF COALESCE(NULLIF(TRIM(v_lead.rutas), ''), NULL) IS NULL THEN
    v_faltantes := v_faltantes || 'rutas';
  END IF;
  IF COALESCE(NULLIF(TRIM(v_lead.volumen), ''), NULL) IS NULL THEN
    v_faltantes := v_faltantes || 'volumen';
  END IF;
  IF COALESCE(NULLIF(TRIM(v_lead.frecuencia), ''), NULL) IS NULL THEN
    v_faltantes := v_faltantes || 'frecuencia';
  END IF;
  IF COALESCE(NULLIF(TRIM(v_lead.dolor_explicito), ''), NULL) IS NULL THEN
    v_faltantes := v_faltantes || 'dolor_explicito';
  END IF;
  IF COALESCE(NULLIF(TRIM(v_lead.proveedor_actual), ''), NULL) IS NULL THEN
    v_faltantes := v_faltantes || 'proveedor_actual';
  END IF;

  IF array_length(v_faltantes, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'LC_LEAD_PERFIL_INCOMPLETO: %', array_to_string(v_faltantes, ',');
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
$$;

-- H6: higiene de permisos — nada para PUBLIC ni anon.
REVOKE ALL ON FUNCTION public.crm_calificar_prospecto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_calificar_prospecto(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_calificar_prospecto(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.crm_calificar_prospecto(uuid) TO service_role;

-- 2) El avance automático por cotización sólo mueve prospectos ya calificados.
CREATE OR REPLACE FUNCTION public._crm_lead_avanzar_por_cotizacion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lead_id uuid;
  v_destino text;
BEGIN
  IF NEW.oportunidad_id IS NULL OR COALESCE(NEW.es_prospecto, false) = false THEN
    RETURN NEW;
  END IF;
  IF NEW.estado::text = 'Aceptada' THEN
    v_destino := 'Pendiente de alta';
  ELSIF NEW.estado::text IN ('Solicitada', 'Enviada') THEN
    v_destino := 'Prospecto';
  ELSE
    RETURN NEW;
  END IF;
  SELECT o.lead_id INTO v_lead_id
  FROM public.crm_oportunidades o
  WHERE o.id = NEW.oportunidad_id
    AND o.organization_id = NEW.organization_id;
  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.crm_leads l
     SET estado = v_destino::public.crm_lead_estado,
         updated_at = now()
   WHERE l.id = v_lead_id
     AND l.organization_id = NEW.organization_id
     AND l.deleted_at IS NULL
     -- Rediseño CRM: no se promueven leads sin calificar; sólo prospectos.
     AND l.estado::text IN ('Prospecto', 'Pendiente de alta')
     AND l.estado::text <> v_destino
     AND NOT (v_destino = 'Prospecto' AND l.estado::text = 'Pendiente de alta');
  RETURN NEW;
END;
$$;

-- 3) Guard: toda oportunidad nace de un prospecto (lead) o de un cliente.
CREATE OR REPLACE FUNCTION public._crm_oportunidad_requiere_origen() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.lead_id IS NULL AND NEW.cliente_id IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_SIN_ORIGEN';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_oportunidad_requiere_origen ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_oportunidad_requiere_origen
  BEFORE INSERT OR UPDATE OF lead_id, cliente_id ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public._crm_oportunidad_requiere_origen();

REVOKE ALL ON FUNCTION public._crm_oportunidad_requiere_origen() FROM PUBLIC;
GRANT ALL ON FUNCTION public._crm_oportunidad_requiere_origen() TO authenticated;
GRANT ALL ON FUNCTION public._crm_oportunidad_requiere_origen() TO service_role;