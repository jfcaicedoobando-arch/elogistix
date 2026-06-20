CREATE OR REPLACE FUNCTION public.resolver_reaprobacion_tarifa(
  p_cotizacion_id UUID, p_decision TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cot        public.cotizaciones%ROWTYPE;
  v_caller_org UUID := current_user_org_id();
  v_is_super   BOOLEAN := has_role(auth.uid(),'super_admin'::app_role);
BEGIN
  IF p_decision NOT IN ('reaprobada','rechazada','recotizada') THEN
    RAISE EXCEPTION 'Decisión inválida: %', p_decision USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id<>v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF v_cot.estado_revalidacion<>'pendiente_reaprobacion' THEN
    RAISE EXCEPTION 'La cotización no está pendiente de re-aprobación (estado: %)', v_cot.estado_revalidacion USING ERRCODE='P0001'; END IF;

  UPDATE public.cotizaciones
  SET estado_revalidacion=p_decision, revalidacion_resuelta_en=now(), updated_at=now()
  WHERE id=p_cotizacion_id;

  INSERT INTO public.bitacora_actividad(
    organization_id,usuario_id,usuario_email,modulo,accion,entidad_id,entidad_nombre,detalles)
  SELECT v_cot.organization_id, auth.uid(),
         COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
         'Cotizaciones','reaprobacion_resuelta', v_cot.id, v_cot.folio,
         jsonb_build_object('decision',p_decision);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_reaprobacion_tarifa(UUID,TEXT) TO authenticated, service_role;