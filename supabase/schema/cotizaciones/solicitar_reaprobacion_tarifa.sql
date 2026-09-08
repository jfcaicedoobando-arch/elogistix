-- Fuente canónica de public.solicitar_reaprobacion_tarifa (R201-COT-02).
-- El snapshot aprobado se calcula en servidor; p_delta_jsonb sólo aporta el
-- detalle visible recibido del cliente y nunca decide la vigencia económica.

CREATE OR REPLACE FUNCTION public.solicitar_reaprobacion_tarifa(p_cotizacion_id uuid, p_delta_jsonb jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cot public.cotizaciones%ROWTYPE;
  v_caller_org uuid := current_user_org_id();
  v_is_super boolean := has_role(auth.uid(),'super_admin'::app_role);
  v_operador_id uuid;
  v_revalidacion jsonb;
  v_delta_seguro jsonb;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  v_revalidacion := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
  v_delta_seguro := COALESCE(p_delta_jsonb, '{}'::jsonb)
    || jsonb_build_object('snapshot_economico', v_revalidacion->'snapshot_economico');

  UPDATE public.cotizaciones
     SET estado_revalidacion='pendiente_reaprobacion',
         revalidacion_solicitada_en=now(), revalidacion_resuelta_en=NULL,
         revalidacion_delta_jsonb=v_delta_seguro, updated_at=now()
   WHERE id=p_cotizacion_id;

  BEGIN v_operador_id := v_cot.operador::uuid;
  EXCEPTION WHEN others THEN v_operador_id := NULL; END;
  IF v_operador_id IS NOT NULL THEN
    INSERT INTO public.notificaciones_internas(
      organization_id,usuario_id,tipo,titulo,mensaje,enlace,entidad_tipo,entidad_id)
    VALUES (v_cot.organization_id,v_operador_id,'tarifa_reaprobacion_requerida',
      'Cotización requiere re-aprobación de tarifa',
      'La cotización '||v_cot.folio||' tiene cambios en la tarifa vigente. Revisa y decide.',
      '/cotizaciones/'||v_cot.id::text,'cotizacion',v_cot.id);
  END IF;

  INSERT INTO public.bitacora_actividad(
    organization_id,usuario_id,usuario_email,modulo,accion,entidad_id,entidad_nombre,detalles)
  SELECT v_cot.organization_id,auth.uid(),COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
    'Cotizaciones','reaprobacion_solicitada',v_cot.id,v_cot.folio,
    jsonb_build_object('delta',v_delta_seguro);
END;
$function$;

REVOKE ALL ON FUNCTION public.solicitar_reaprobacion_tarifa(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_reaprobacion_tarifa(uuid, jsonb) TO authenticated, service_role;