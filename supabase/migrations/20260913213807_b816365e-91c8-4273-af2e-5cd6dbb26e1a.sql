-- v13.823.351 · Auditoría YAGNI: permisos de re-aprobación/re-cotización,
-- invariante de snapshot, duplicado completo y aislamiento por organización.

CREATE OR REPLACE FUNCTION public.puede_aprobar_tarifa_cotizacion(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'vendedor'::app_role)
    OR public.has_role(_user_id, 'ejecutivo_pricing'::app_role)
  )
$function$;

REVOKE ALL ON FUNCTION public.puede_aprobar_tarifa_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_aprobar_tarifa_cotizacion(uuid) TO authenticated, service_role;

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

  IF NOT public.puede_aprobar_tarifa_cotizacion(auth.uid()) THEN
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

CREATE OR REPLACE FUNCTION public.recotizar_cotizacion(p_cotizacion_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old INT;
  v_new INT;
  v_org UUID;
  v_folio TEXT;
  v_estado TEXT;
  v_revalidacion TEXT;
  v_embarque_expediente TEXT;
BEGIN
  SELECT version, organization_id, folio, estado::text, estado_revalidacion
    INTO v_old, v_org, v_folio, v_estado, v_revalidacion
  FROM cotizaciones WHERE id = p_cotizacion_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_org AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;
  IF NOT public.puede_aprobar_tarifa_cotizacion(auth.uid()) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: sólo ventas o administración pueden re-cotizar'
      USING ERRCODE='42501';
  END IF;
  IF length(coalesce(trim(p_motivo),'')) < 5 THEN
    RAISE EXCEPTION 'Motivo requerido (mínimo 5 caracteres)' USING ERRCODE='22023';
  END IF;
  IF v_estado <> 'Aceptada' THEN
    RAISE EXCEPTION 'LC_RECOTIZAR_ESTADO_INVALIDO'
      USING HINT = v_estado, ERRCODE = 'P0001';
  END IF;
  SELECT expediente INTO v_embarque_expediente
  FROM public.embarques
  WHERE cotizacion_id = p_cotizacion_id
    AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;
  IF v_embarque_expediente IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_CON_EMBARQUE'
      USING HINT = v_embarque_expediente,
            ERRCODE = 'P0001';
  END IF;
  PERFORM archivar_version_cotizacion(p_cotizacion_id, p_motivo);
  v_new := v_old + 1;
  UPDATE cotizaciones
     SET version = v_new,
         estado = 'Borrador',
         estado_revalidacion = CASE WHEN v_revalidacion = 'pendiente_reaprobacion'
                                    THEN 'recotizada' ELSE estado_revalidacion END,
         revalidacion_resuelta_en = CASE WHEN v_revalidacion = 'pendiente_reaprobacion'
                                    THEN now() ELSE revalidacion_resuelta_en END,
         updated_at = now()
   WHERE id = p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (
    v_org,
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'cotizacion.versionada',
    'cotizaciones',
    p_cotizacion_id,
    COALESCE(v_folio, ''),
    jsonb_build_object('version_anterior', v_old, 'version_nueva', v_new, 'motivo', p_motivo)
  );
  RETURN jsonb_build_object('cotizacion_id', p_cotizacion_id, 'version_anterior', v_old, 'version_nueva', v_new);
END $function$;

REVOKE ALL ON FUNCTION public.recotizar_cotizacion(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recotizar_cotizacion(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.duplicar_cotizacion(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_deleted timestamptz;
  v_nueva_id uuid := gen_random_uuid();
  v_folio text;
BEGIN
  SELECT organization_id, deleted_at INTO v_org, v_deleted
    FROM public.cotizaciones WHERE id = p_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_ELIMINADA: no se puede duplicar una cotización eliminada'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_org IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'No pertenece a tu organización' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador') OR public.has_role(auth.uid(), 'ejecutivo_pricing')) THEN
    RAISE EXCEPTION 'Rol insuficiente para duplicar cotizaciones' USING ERRCODE = '42501';
  END IF;

  v_folio := public.siguiente_folio_cotizacion();

  INSERT INTO public.cotizaciones (
    id, folio, organization_id, duplicada_de_id,
    cliente_id, cliente_nombre, es_prospecto,
    prospecto_empresa, prospecto_contacto, prospecto_email, prospecto_telefono,
    oportunidad_id,
    modo, tipo, incoterm, tipo_movimiento, tipo_documento,
    descripcion_mercancia, descripcion_adicional, sector_economico, comentario_cliente,
    peso_kg, volumen_m3, piezas, tipo_peso,
    tipo_carga, msds_archivo, tipo_embarque, tipo_contenedor, num_contenedores,
    tipo_unidad, modalidad_equipo,
    dimensiones_lcl, dimensiones_aereas,
    origen, destino, punto_intermedio, ruta_texto,
    tiempo_transito_dias, frecuencia,
    seguro, valor_seguro_usd, carta_garantia,
    dias_libres_destino, dias_almacenaje,
    lcl_tarifa_wm, lcl_minimo_flete, lcl_dias_libres_almacenaje, lcl_consolidador_id,
    agente_id, naviera_id,
    tarifa_id, tarifa_override, tarifas_informativas,
    tipo_cambio_usd, sin_desglose_costos,
    conceptos_venta, subtotal, moneda, notas, operador,
    vigencia_dias, estado, version, estado_revalidacion, created_by
  )
  SELECT
    v_nueva_id, v_folio, v_org, p_id,
    cliente_id, cliente_nombre, es_prospecto,
    prospecto_empresa, prospecto_contacto, prospecto_email, prospecto_telefono,
    oportunidad_id,
    modo, tipo, incoterm, tipo_movimiento, tipo_documento,
    descripcion_mercancia, descripcion_adicional, sector_economico, comentario_cliente,
    peso_kg, volumen_m3, piezas, tipo_peso,
    tipo_carga, msds_archivo, tipo_embarque, tipo_contenedor, num_contenedores,
    tipo_unidad, modalidad_equipo,
    dimensiones_lcl, dimensiones_aereas,
    origen, destino, punto_intermedio, ruta_texto,
    tiempo_transito_dias, frecuencia,
    seguro, valor_seguro_usd, carta_garantia,
    dias_libres_destino, dias_almacenaje,
    lcl_tarifa_wm, lcl_minimo_flete, lcl_dias_libres_almacenaje, lcl_consolidador_id,
    agente_id, naviera_id,
    tarifa_id, tarifa_override, tarifas_informativas,
    tipo_cambio_usd, sin_desglose_costos,
    conceptos_venta, subtotal, moneda, notas, operador,
    vigencia_dias,
    'Borrador'::estado_cotizacion, 1, 'ninguna', auth.uid()
  FROM public.cotizaciones
  WHERE id = p_id;

  INSERT INTO public.cotizacion_costos
    (cotizacion_id, organization_id, concepto, moneda, proveedor, unidad_medida,
     cantidad, costo_unitario, precio_venta, notas,
     costeo_tarifa_id, costeo_tarifa_recargo_id)
  SELECT v_nueva_id, v_org, concepto, moneda, proveedor, unidad_medida,
         cantidad, costo_unitario, precio_venta, notas,
         costeo_tarifa_id, costeo_tarifa_recargo_id
    FROM public.cotizacion_costos
   WHERE cotizacion_id = p_id
     AND deleted_at IS NULL;

  RETURN v_nueva_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.duplicar_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_cotizacion(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revalidar_tarifa_cotizacion(p_cotizacion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cot             public.cotizaciones%ROWTYPE;
  v_caller_org      UUID := current_user_org_id();
  v_is_super        BOOLEAN := has_role(auth.uid(),'super_admin'::app_role);
  v_umbral_pct      NUMERIC;
  v_bloquea_vencida BOOLEAN;
  v_tarifa_vigente  BOOLEAN := FALSE;
  v_tarifa_vig_rec  RECORD;
  v_cambios         JSONB := '[]'::jsonb;
  v_max_delta_pct   NUMERIC := 0;
  v_severidad       TEXT;
  v_costo           RECORD;
  v_monto_actual    NUMERIC;
  v_delta_abs       NUMERIC;
  v_delta_pct       NUMERIC;
  v_reaprob_vigente BOOLEAN := FALSE;
  v_snapshot        JSONB;
  v_snapshot_aprob  JSONB;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT COALESCE((valor#>>'{}')::numeric,5) INTO v_umbral_pct
    FROM public.configuracion
    WHERE categoria='operaciones' AND clave='tarifa_revalidacion_umbral_pct';
  v_umbral_pct := COALESCE(v_umbral_pct,5);
  SELECT COALESCE((valor#>>'{}')::boolean,TRUE) INTO v_bloquea_vencida
    FROM public.configuracion
    WHERE categoria='operaciones' AND clave='tarifa_revalidacion_bloquea_si_vencida';
  v_bloquea_vencida := COALESCE(v_bloquea_vencida,TRUE);
  IF v_cot.tarifa_id IS NULL THEN
    RETURN jsonb_build_object(
      'tarifa_vigente',TRUE,'agente_sin_cupo',FALSE,'severidad','sin_cambios',
      'cambios','[]'::jsonb,'umbral_pct',v_umbral_pct,'max_delta_pct',0,
      'estado_revalidacion',v_cot.estado_revalidacion,'reaprobacion_vigente',FALSE,
      'motivo','sin_tarifa_vinculada');
  END IF;
  -- v13.823.351: la tarifa vigente y sus recargos se leen acotados a la
  -- organización de la cotización (las FK son sólo por UUID).
  SELECT * INTO v_tarifa_vig_rec FROM public.costeo_tarifas_vigentes_v
   WHERE id=v_cot.tarifa_id AND organization_id=v_cot.organization_id LIMIT 1;
  v_tarifa_vigente := FOUND;
  FOR v_costo IN
    SELECT cc.concepto, cc.moneda, cc.costo_unitario AS monto_anterior,
           cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id
    FROM public.cotizacion_costos cc
    WHERE cc.cotizacion_id=v_cot.id AND cc.deleted_at IS NULL
      AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL)
  LOOP
    IF v_costo.costeo_tarifa_recargo_id IS NOT NULL THEN
      SELECT monto INTO v_monto_actual FROM public.costeo_tarifa_recargos
       WHERE id=v_costo.costeo_tarifa_recargo_id AND organization_id=v_cot.organization_id;
    ELSE
      SELECT flete_base INTO v_monto_actual FROM public.costeo_tarifas
       WHERE id=v_costo.costeo_tarifa_id AND organization_id=v_cot.organization_id;
    END IF;
    IF v_monto_actual IS NULL THEN
      v_cambios := v_cambios || jsonb_build_object(
        'concepto',v_costo.concepto,'moneda',v_costo.moneda,
        'monto_anterior',v_costo.monto_anterior,'monto_actual',NULL,
        'delta_abs',NULL,'delta_pct',NULL,'motivo','eliminado');
      v_max_delta_pct := 100;
      CONTINUE;
    END IF;
    v_delta_abs := v_monto_actual - v_costo.monto_anterior;
    v_delta_pct := CASE WHEN v_costo.monto_anterior=0
                     THEN CASE WHEN v_delta_abs=0 THEN 0 ELSE 100 END
                     ELSE ROUND(ABS(v_delta_abs)/v_costo.monto_anterior*100,2) END;
    IF ABS(v_delta_abs) > 0.001 THEN
      v_cambios := v_cambios || jsonb_build_object(
        'concepto',v_costo.concepto,'moneda',v_costo.moneda,
        'monto_anterior',v_costo.monto_anterior,'monto_actual',v_monto_actual,
        'delta_abs',v_delta_abs,'delta_pct',v_delta_pct);
      IF v_delta_pct > v_max_delta_pct THEN v_max_delta_pct := v_delta_pct; END IF;
    END IF;
  END LOOP;

  SELECT jsonb_build_object(
    'tarifa_vigente', v_tarifa_vigente,
    'filas', COALESCE(jsonb_agg(jsonb_build_object(
      'cotizacion_costo_id', cc.id,
      'tarifa_id', cc.costeo_tarifa_id,
      'recargo_id', cc.costeo_tarifa_recargo_id,
      'cantidad', cc.cantidad,
      'moneda', cc.moneda,
      'monto_actual', CASE WHEN cc.costeo_tarifa_recargo_id IS NOT NULL THEN r.monto ELSE t.flete_base END
    ) ORDER BY cc.id), '[]'::jsonb)
  ) INTO v_snapshot
  FROM public.cotizacion_costos cc
  LEFT JOIN public.costeo_tarifa_recargos r
         ON r.id=cc.costeo_tarifa_recargo_id AND r.organization_id=v_cot.organization_id
  LEFT JOIN public.costeo_tarifas t
         ON t.id=cc.costeo_tarifa_id AND t.organization_id=v_cot.organization_id
  WHERE cc.cotizacion_id=v_cot.id AND cc.deleted_at IS NULL
    AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL);
  IF NOT v_tarifa_vigente AND v_bloquea_vencida THEN v_severidad := 'bloqueante';
  ELSIF jsonb_array_length(v_cambios)=0 AND v_tarifa_vigente THEN v_severidad := 'sin_cambios';
  ELSIF v_max_delta_pct > v_umbral_pct THEN v_severidad := 'bloqueante';
  ELSE v_severidad := 'informativa';
  END IF;

  IF v_severidad = 'bloqueante' AND v_cot.estado_revalidacion = 'reaprobada' THEN
    v_snapshot_aprob := v_cot.revalidacion_delta_jsonb->'snapshot_economico';
    IF v_snapshot_aprob IS NOT NULL AND v_snapshot_aprob = v_snapshot THEN
      v_severidad := 'informativa';
      v_reaprob_vigente := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'tarifa_vigente',v_tarifa_vigente,'agente_sin_cupo',FALSE,'severidad',v_severidad,
    'cambios',v_cambios,'umbral_pct',v_umbral_pct,'max_delta_pct',v_max_delta_pct,
    'estado_revalidacion',v_cot.estado_revalidacion,
    'reaprobacion_vigente',v_reaprob_vigente,
    'snapshot_economico',v_snapshot,
    'motivo',CASE WHEN v_reaprob_vigente THEN 'reaprobada_por_ventas' ELSE NULL END,
    'tarifa_id_vigente',CASE WHEN v_tarifa_vigente THEN v_cot.tarifa_id ELSE NULL END);
END;
$function$;

REVOKE ALL ON FUNCTION public.revalidar_tarifa_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revalidar_tarifa_cotizacion(uuid) TO authenticated, service_role;
