-- Cierre H4/H6 CRM: reemisión idempotente, sin reescribir migraciones aplicadas.
-- Mismos nombres, tablas, columnas y predicado que los índices ya existentes.
-- No elimina índices, no modifica registros ni amplía permisos.
CREATE INDEX IF NOT EXISTS idx_crm_actividades_oportunidad ON public.crm_actividades(oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_crm_valores_registro ON public.crm_valores(registro_id);
CREATE INDEX IF NOT EXISTS idx_crm_valores_org_prop ON public.crm_valores(organization_id, propiedad_id);
CREATE INDEX IF NOT EXISTS crm_solicitudes_pricing_op_idx ON public.crm_solicitudes_pricing(oportunidad_id);
CREATE INDEX IF NOT EXISTS crm_solicitudes_pricing_estado_idx ON public.crm_solicitudes_pricing(organization_id, estado);
CREATE INDEX IF NOT EXISTS crm_pricing_opciones_sol_idx ON public.crm_pricing_opciones(solicitud_id);
CREATE INDEX IF NOT EXISTS crm_scoring_reglas_objeto_idx ON public.crm_scoring_reglas (objeto, criterio) WHERE activa;
CREATE INDEX IF NOT EXISTS crm_reportes_tablero_idx ON public.crm_reportes(tablero_id);

-- Misma definición vigente del 20261002000512; sólo se explicita su ACL.
CREATE OR REPLACE FUNCTION public.crm_enviar_solicitud_pricing(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_horas int;
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
  IF v.servicio IS NULL OR coalesce(trim(v.origen), trim(v.pol), '') = '' OR coalesce(trim(v.destino), trim(v.pod), '') = '' THEN
    RAISE EXCEPTION 'LC_PRICING_INCOMPLETA' USING ERRCODE = 'P0001';
  END IF;
  v_horas := CASE v.complejidad WHEN 'baja' THEN 8 WHEN 'alta' THEN 48 ELSE 24 END;
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE public.crm_solicitudes_pricing SET estado = 'enviada', enviada_at = now(),
    vence_at = now() + make_interval(hours => v_horas) WHERE id = p_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT v.organization_id, om.user_id, 'crm_pricing_solicitud', 'Nueva solicitud de pricing ' || v.folio,
         coalesce(v.cliente, 'Sin cliente') || ' · ' || coalesce(v.origen, v.pol, '') || ' → ' || coalesce(v.destino, v.pod, '')
           || ' · responder en ' || v_horas || ' h',
         '/costeo/solicitudes?id=' || v.id, 'crm_solicitud_pricing', v.id
    FROM public.organization_members om
   WHERE om.organization_id = v.organization_id AND om.role = 'ejecutivo_pricing';
  RETURN jsonb_build_object('id', v.id, 'ya_enviada', false);
END $$;
REVOKE ALL ON FUNCTION public.crm_enviar_solicitud_pricing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_enviar_solicitud_pricing(uuid) TO authenticated, service_role;
