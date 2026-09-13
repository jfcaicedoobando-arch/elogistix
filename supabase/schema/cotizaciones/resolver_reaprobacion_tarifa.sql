-- Fuente canónica de public.resolver_reaprobacion_tarifa (v13.823.354).
--
-- Antes: cualquier miembro autenticado de la organización (viewer, contador,
-- tesorero, operación) podía aprobar/rechazar/recotizar por RPC directa, y la
-- decisión `reaprobada` se aceptaba aunque la tarifa hubiera cambiado otra vez
-- después de la solicitud (dejando un estado que luego fallaba al crear el
-- embarque con LC_REAPROBACION_NO_VIGENTE).
--
-- Ahora:
--   · Exige el rol aprobador comercial (`puede_aprobar_tarifa_cotizacion`),
--     evaluado en la organización de la cotización (ancla tenant explícita).
--   · Sólo admite `reaprobada` y `rechazada`. `recotizada` deja de ser una
--     decisión directa: la única transición válida es `recotizar_cotizacion`,
--     que la escribe cuando la nueva versión ya existe.
--   · `reaprobada` exige que el snapshot económico que ventas autorizó siga
--     siendo el vigente (LC_REVALIDACION_DESACTUALIZADA) y congela ese snapshot
--     en `revalidacion_delta_jsonb`.

CREATE OR REPLACE FUNCTION public.resolver_reaprobacion_tarifa(p_cotizacion_id uuid, p_decision text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cot        public.cotizaciones%ROWTYPE;
  v_caller_org UUID := current_user_org_id();
  v_is_super   BOOLEAN := has_role(auth.uid(),'super_admin'::app_role);
  v_rev        JSONB;
  v_snap_actual JSONB;
  v_snap_aprob  JSONB;
BEGIN
  IF p_decision = 'recotizada' THEN
    RAISE EXCEPTION 'LC_RECOTIZADA_NO_DIRECTA: la re-cotización se registra al versionar la cotización'
      USING ERRCODE='P0001';
  END IF;
  IF p_decision NOT IN ('reaprobada','rechazada') THEN
    RAISE EXCEPTION 'Decisión inválida: %', p_decision USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_cot FROM public.cotizaciones
   WHERE id=p_cotizacion_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  IF NOT public.puede_aprobar_tarifa_cotizacion(auth.uid(), v_cot.organization_id) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: sólo ventas o administración pueden resolver la re-aprobación de tarifa'
      USING ERRCODE='42501';
  END IF;

  IF v_cot.estado_revalidacion<>'pendiente_reaprobacion' THEN
    RAISE EXCEPTION 'La cotización no está pendiente de re-aprobación (estado: %)', v_cot.estado_revalidacion USING ERRCODE='P0001'; END IF;

  IF p_decision='reaprobada' THEN
    v_rev := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
    v_snap_actual := v_rev->'snapshot_economico';
    v_snap_aprob  := v_cot.revalidacion_delta_jsonb->'snapshot_economico';
    IF v_snap_aprob IS NULL OR v_snap_actual IS DISTINCT FROM v_snap_aprob THEN
      RAISE EXCEPTION 'LC_REVALIDACION_DESACTUALIZADA: la tarifa cambió después de la solicitud; pide una nueva re-aprobación'
        USING ERRCODE='P0001';
    END IF;
  END IF;

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
$function$;

REVOKE ALL ON FUNCTION public.resolver_reaprobacion_tarifa(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_reaprobacion_tarifa(uuid, text) TO authenticated, service_role;
