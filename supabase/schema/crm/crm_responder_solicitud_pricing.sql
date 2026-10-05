CREATE OR REPLACE FUNCTION public.crm_responder_solicitud_pricing(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.crm_solicitudes_pricing WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public._crm_es_pricing(v.organization_id) THEN RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501'; END IF;
  IF v.estado = 'respondida' THEN RETURN jsonb_build_object('id', v.id, 'ya_respondida', true); END IF;
  IF v.estado <> 'enviada' THEN RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.costeo_tarifas WHERE solicitud_pricing_id = p_id)
     AND NOT EXISTS (SELECT 1 FROM public.crm_pricing_opciones WHERE solicitud_id = p_id) THEN
    RAISE EXCEPTION 'LC_PRICING_SIN_OPCIONES' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE public.crm_solicitudes_pricing SET estado = 'respondida', respondida_at = now() WHERE id = p_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  VALUES (v.organization_id, v.solicitante_id, 'crm_pricing_respuesta', 'Pricing respondió ' || v.folio,
          'Ya hay opciones de tarifa para ' || coalesce(v.cliente, 'tu solicitud'),
          '/crm/oportunidades/' || v.oportunidad_id, 'crm_solicitud_pricing', v.id);
  RETURN jsonb_build_object('id', v.id, 'ya_respondida', false);
END $function$;

REVOKE ALL ON FUNCTION public.crm_responder_solicitud_pricing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_responder_solicitud_pricing(uuid) TO authenticated, service_role;
