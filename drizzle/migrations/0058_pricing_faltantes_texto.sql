CREATE OR REPLACE FUNCTION public.crm_enviar_solicitud_pricing(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF v.solicitante_id IS NULL THEN v_faltan := v_faltan || 'Solicitante'::text; END IF;
  IF v.fecha IS NULL THEN v_faltan := v_faltan || 'Fecha'::text; END IF;
  IF coalesce(trim(v.cliente), '') = '' THEN v_faltan := v_faltan || 'Cliente'::text; END IF;
  IF v.servicio IS NULL THEN v_faltan := v_faltan || 'Modo de transporte'::text; END IF;
  IF v.tipo_operacion IS NULL THEN v_faltan := v_faltan || 'Tipo de operación'::text; END IF;
  IF v.incoterm IS NULL THEN v_faltan := v_faltan || 'Incoterm'::text; END IF;
  IF v.sector_economico IS NULL THEN v_faltan := v_faltan || 'Sector económico'::text; END IF;
  IF v.imo IS NULL THEN v_faltan := v_faltan || 'IMO'::text; END IF;
  IF coalesce(trim(v.commodity), '') = '' THEN v_faltan := v_faltan || 'Commodity'::text; END IF;
  IF v.tipo_carga IS NULL THEN v_faltan := v_faltan || 'Tipo de contenedor'::text; END IF;
  IF v.cantidad IS NULL THEN v_faltan := v_faltan || 'Cantidad'::text; END IF;
  IF v.estibable IS NULL THEN v_faltan := v_faltan || 'Estibable'::text; END IF;
  IF coalesce(trim(v.peso), '') = '' THEN v_faltan := v_faltan || 'Peso'::text; END IF;
  IF v.unidad_medida IS NULL THEN v_faltan := v_faltan || 'Unidad de medida'::text; END IF;
  IF coalesce(trim(v.dimensiones), '') = '' THEN v_faltan := v_faltan || 'Dimensiones'::text; END IF;
  IF coalesce(trim(v.origen), '') = '' THEN v_faltan := v_faltan || 'País de origen'::text; END IF;
  IF coalesce(trim(v.pol), '') = '' THEN v_faltan := v_faltan || 'Puerto de origen'::text; END IF;
  IF coalesce(trim(v.destino), '') = '' THEN v_faltan := v_faltan || 'País de destino'::text; END IF;
  IF coalesce(trim(v.pod), '') = '' THEN v_faltan := v_faltan || 'Puerto de destino'::text; END IF;
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
END $function$;