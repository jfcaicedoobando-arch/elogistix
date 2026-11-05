ALTER TABLE public.crm_solicitudes_pricing
  ADD COLUMN IF NOT EXISTS tipo_solicitud text,
  ADD COLUMN IF NOT EXISTS complejidad_motivo text,
  ADD COLUMN IF NOT EXISTS plazo_motivo text;
ALTER TABLE public.crm_solicitudes_pricing
  ADD CONSTRAINT crm_solicitudes_pricing_tipo_solicitud_chk
  CHECK (tipo_solicitud IS NULL OR tipo_solicitud IN ('nuevas_tarifas','nueva_ruta'));

-- Horas de respuesta por complejidad: baja = estándar (sin contador), media = 36 h, alta = 48 h.
CREATE OR REPLACE FUNCTION public._crm_pricing_horas(p_complejidad text)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_complejidad WHEN 'baja' THEN NULL WHEN 'alta' THEN 48 ELSE 36 END
$$;

CREATE OR REPLACE FUNCTION public._crm_pricing_es_gerente_ops(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::app_role) OR EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org AND user_id = auth.uid() AND role IN ('gerente_operaciones','admin_org','admin'))
$$;
REVOKE ALL ON FUNCTION public._crm_pricing_es_gerente_ops(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._crm_pricing_es_gerente_ops(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._crm_sol_pricing_before_upd()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.folio <> OLD.folio OR NEW.organization_id <> OLD.organization_id
     OR NEW.oportunidad_id <> OLD.oportunidad_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'LC_PRICING_INMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(current_setting('lc.pricing_rpc', true), '') <> '1' AND (
     NEW.estado IS DISTINCT FROM OLD.estado OR NEW.enviada_at IS DISTINCT FROM OLD.enviada_at
     OR NEW.vence_at IS DISTINCT FROM OLD.vence_at OR NEW.respondida_at IS DISTINCT FROM OLD.respondida_at
     OR NEW.complejidad_motivo IS DISTINCT FROM OLD.complejidad_motivo OR NEW.plazo_motivo IS DISTINCT FROM OLD.plazo_motivo
     OR (OLD.estado <> 'borrador' AND (NEW.complejidad IS DISTINCT FROM OLD.complejidad
         OR NEW.tipo_solicitud IS DISTINCT FROM OLD.tipo_solicitud))) THEN
    RAISE EXCEPTION 'LC_PRICING_ESTADO_SOLO_RPC' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.crm_enviar_solicitud_pricing(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_horas int; v_comp text; v_faltan text[] := '{}';
BEGIN
  SELECT * INTO v FROM public.crm_solicitudes_pricing WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF v.estado = 'enviada' THEN RETURN jsonb_build_object('id', v.id, 'vence_at', v.vence_at, 'ya_enviada', true); END IF;
  IF v.estado <> 'borrador' THEN RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001'; END IF;
  IF v.created_by IS DISTINCT FROM auth.uid() AND NOT public._crm_es_pricing(v.organization_id) THEN
    RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501';
  END IF;
  -- Obligatorios: todo excepto notas, delivery, fecha tentativa de carga y adjuntos.
  IF v.solicitante_id IS NULL THEN v_faltan := v_faltan || 'Solicitante'; END IF;
  IF v.fecha IS NULL THEN v_faltan := v_faltan || 'Fecha'; END IF;
  IF coalesce(trim(v.cliente), '') = '' THEN v_faltan := v_faltan || 'Cliente'; END IF;
  IF v.servicio IS NULL THEN v_faltan := v_faltan || 'Modo de transporte'; END IF;
  IF v.tipo_operacion IS NULL THEN v_faltan := v_faltan || 'Tipo de operación'; END IF;
  IF v.incoterm IS NULL THEN v_faltan := v_faltan || 'Incoterm'; END IF;
  IF v.sector_economico IS NULL THEN v_faltan := v_faltan || 'Sector económico'; END IF;
  IF v.imo IS NULL THEN v_faltan := v_faltan || 'IMO'; END IF;
  IF coalesce(trim(v.commodity), '') = '' THEN v_faltan := v_faltan || 'Commodity'; END IF;
  IF v.tipo_carga IS NULL THEN v_faltan := v_faltan || 'Tipo de contenedor'; END IF;
  IF v.cantidad IS NULL THEN v_faltan := v_faltan || 'Cantidad'; END IF;
  IF v.estibable IS NULL THEN v_faltan := v_faltan || 'Estibable'; END IF;
  IF coalesce(trim(v.peso), '') = '' THEN v_faltan := v_faltan || 'Peso'; END IF;
  IF v.unidad_medida IS NULL THEN v_faltan := v_faltan || 'Unidad de medida'; END IF;
  IF coalesce(trim(v.dimensiones), '') = '' THEN v_faltan := v_faltan || 'Dimensiones'; END IF;
  IF coalesce(trim(v.origen), '') = '' THEN v_faltan := v_faltan || 'País de origen'; END IF;
  IF coalesce(trim(v.pol), '') = '' THEN v_faltan := v_faltan || 'Puerto de origen'; END IF;
  IF coalesce(trim(v.destino), '') = '' THEN v_faltan := v_faltan || 'País de destino'; END IF;
  IF coalesce(trim(v.pod), '') = '' THEN v_faltan := v_faltan || 'Puerto de destino'; END IF;
  IF array_length(v_faltan, 1) > 0 THEN
    RAISE EXCEPTION 'LC_PRICING_INCOMPLETA: %', array_to_string(v_faltan, ', ') USING ERRCODE = 'P0001';
  END IF;
  -- Complejidad automática: especial si hay IMO, carga proyecto o contenedor especial.
  v_comp := CASE WHEN v.imo IS TRUE OR v.sector_economico = 'Carga Proyecto'
      OR v.tipo_carga ~* '(open ?top|flat ?rack|reefer|refriger|platform|plataforma|tank|isotanque|special|especial)'
    THEN 'alta' ELSE 'media' END;
  v_horas := public._crm_pricing_horas(v_comp);
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE public.crm_solicitudes_pricing SET estado = 'enviada', enviada_at = now(), complejidad = v_comp,
    tipo_solicitud = coalesce(v.tipo_solicitud, 'nueva_ruta'),
    vence_at = now() + make_interval(hours => v_horas) WHERE id = p_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT DISTINCT v.organization_id, om.user_id, 'crm_pricing_solicitud', 'Nueva solicitud de pricing ' || v.folio,
         coalesce(v.cliente, 'Sin cliente') || ' · ' || coalesce(v.pol, v.origen, '') || ' → ' || coalesce(v.pod, v.destino, '')
           || ' · responder en ' || v_horas || ' h',
         '/costeo/solicitudes?id=' || v.id, 'crm_solicitud_pricing', v.id
    FROM public.organization_members om
   WHERE om.organization_id = v.organization_id AND om.role IN ('ejecutivo_pricing','gerente_operaciones');
  RETURN jsonb_build_object('id', v.id, 'ya_enviada', false);
END $$;

CREATE OR REPLACE FUNCTION public._crm_pricing_avisar_cambio(p_org uuid, p_sol uuid, p_solicitante uuid, p_titulo text, p_msg text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT DISTINCT p_org, x.uid, 'crm_pricing_cambio', p_titulo, p_msg,
         '/costeo/solicitudes?id=' || p_sol, 'crm_solicitud_pricing', p_sol
  FROM (SELECT p_solicitante AS uid
        UNION SELECT user_id FROM organization_members WHERE organization_id = p_org AND role IN ('admin_org','admin')) x
  WHERE x.uid IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public._crm_pricing_avisar_cambio(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.crm_pricing_cambiar_complejidad(p_id uuid, p_complejidad text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_horas int;
BEGIN
  SELECT * INTO v FROM crm_solicitudes_pricing WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM org_scope() THEN RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001'; END IF;
  IF NOT _crm_pricing_es_gerente_ops(v.organization_id) THEN RAISE EXCEPTION 'LC_PRICING_SOLO_GERENTE_OPS' USING ERRCODE = '42501'; END IF;
  IF v.estado <> 'enviada' THEN RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001'; END IF;
  IF p_complejidad NOT IN ('baja','media','alta') THEN RAISE EXCEPTION 'LC_PRICING_COMPLEJIDAD_INVALIDA' USING ERRCODE = 'P0001'; END IF;
  IF length(trim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'LC_PRICING_MOTIVO_REQUERIDO' USING ERRCODE = 'P0001'; END IF;
  IF p_complejidad = v.complejidad THEN RETURN jsonb_build_object('id', v.id, 'sin_cambio', true); END IF;
  v_horas := _crm_pricing_horas(p_complejidad);
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE crm_solicitudes_pricing SET complejidad = p_complejidad, complejidad_motivo = trim(p_motivo), plazo_motivo = NULL,
    vence_at = CASE WHEN v_horas IS NULL THEN NULL ELSE enviada_at + make_interval(hours => v_horas) END
   WHERE id = p_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
  PERFORM _crm_pricing_avisar_cambio(v.organization_id, v.id, v.solicitante_id, 'Cambio de complejidad ' || v.folio,
    'Nueva complejidad: ' || p_complejidad || ' · Motivo: ' || trim(p_motivo));
  RETURN jsonb_build_object('id', v.id, 'sin_cambio', false);
END $$;

CREATE OR REPLACE FUNCTION public.crm_pricing_ampliar_plazo(p_id uuid, p_horas int, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM crm_solicitudes_pricing WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM org_scope() THEN RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001'; END IF;
  IF NOT _crm_pricing_es_gerente_ops(v.organization_id) THEN RAISE EXCEPTION 'LC_PRICING_SOLO_GERENTE_OPS' USING ERRCODE = '42501'; END IF;
  IF v.estado <> 'enviada' OR v.complejidad <> 'alta' THEN RAISE EXCEPTION 'LC_PRICING_PLAZO_NO_AMPLIABLE' USING ERRCODE = 'P0001'; END IF;
  IF now() > v.enviada_at + interval '8 hours' THEN RAISE EXCEPTION 'LC_PRICING_PLAZO_FUERA_DE_TIEMPO' USING ERRCODE = 'P0001'; END IF;
  IF p_horas IS NULL OR p_horas <= 48 OR p_horas > 720 THEN RAISE EXCEPTION 'LC_PRICING_HORAS_INVALIDAS' USING ERRCODE = 'P0001'; END IF;
  IF length(trim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'LC_PRICING_MOTIVO_REQUERIDO' USING ERRCODE = 'P0001'; END IF;
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE crm_solicitudes_pricing SET vence_at = enviada_at + make_interval(hours => p_horas), plazo_motivo = trim(p_motivo)
   WHERE id = p_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
  PERFORM _crm_pricing_avisar_cambio(v.organization_id, v.id, v.solicitante_id, 'Nuevo plazo ' || v.folio,
    'Plazo de respuesta: ' || p_horas || ' h · Motivo: ' || trim(p_motivo));
  RETURN jsonb_build_object('id', v.id);
END $$;
REVOKE ALL ON FUNCTION public.crm_pricing_cambiar_complejidad(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_pricing_ampliar_plazo(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_pricing_cambiar_complejidad(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_pricing_ampliar_plazo(uuid, int, text) TO authenticated;

-- Pricing puede seguir agregando opciones aunque la solicitud ya esté respondida.
CREATE OR REPLACE FUNCTION public._crm_pricing_opcion_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sol record;
BEGIN
  SELECT organization_id, estado INTO v_sol FROM public.crm_solicitudes_pricing
   WHERE id = coalesce(NEW.solicitud_id, OLD.solicitud_id);
  IF v_sol.estado IS NULL OR v_sol.estado NOT IN ('enviada','respondida') THEN
    RAISE EXCEPTION 'LC_PRICING_NO_EDITABLE' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND NEW.solicitud_id <> OLD.solicitud_id THEN
    RAISE EXCEPTION 'LC_PRICING_INMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.organization_id <> v_sol.organization_id THEN
    RAISE EXCEPTION 'LC_PRICING_ORG' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_by := auth.uid(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public._costeo_tarifa_solicitud_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_estado text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.solicitud_pricing_id IS DISTINCT FROM OLD.solicitud_pricing_id THEN
    RAISE EXCEPTION 'LC_TARIFA_SOLICITUD_INMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.solicitud_pricing_id IS NOT NULL THEN
    SELECT organization_id, estado INTO v_org, v_estado
      FROM public.crm_solicitudes_pricing WHERE id = NEW.solicitud_pricing_id AND deleted_at IS NULL;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
    END IF;
    IF v_estado IS NULL OR v_estado NOT IN ('enviada','respondida') THEN
      RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public._crm_es_pricing(v_org) THEN
      RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;