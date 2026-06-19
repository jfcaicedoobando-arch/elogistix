
-- 1) Columnas en embarques
ALTER TABLE public.embarques
  ADD COLUMN IF NOT EXISTS tarifa_id_original UUID REFERENCES public.costeo_tarifas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tarifa_id_aplicada UUID REFERENCES public.costeo_tarifas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tarifa_delta_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS tarifa_decision TEXT,
  ADD COLUMN IF NOT EXISTS tarifa_revalidada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tarifa_revalidada_por UUID REFERENCES auth.users(id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='embarques_tarifa_decision_chk') THEN
    ALTER TABLE public.embarques ADD CONSTRAINT embarques_tarifa_decision_chk
      CHECK (tarifa_decision IS NULL OR tarifa_decision IN
        ('sin_cambios','mantenida_por_operaciones','refrescada','sustituida','reaprobada_ventas'));
  END IF;
END $$;

-- 2) Columnas en cotizaciones
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS estado_revalidacion TEXT NOT NULL DEFAULT 'ninguna',
  ADD COLUMN IF NOT EXISTS revalidacion_solicitada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revalidacion_resuelta_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revalidacion_delta_jsonb JSONB;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cotizaciones_estado_revalidacion_chk') THEN
    ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_estado_revalidacion_chk
      CHECK (estado_revalidacion IN ('ninguna','pendiente_reaprobacion','reaprobada','rechazada'));
  END IF;
END $$;

-- 3) Configuración: única fila por (categoria, clave) — se asocia a la primera org disponible.
INSERT INTO public.configuracion (organization_id, categoria, clave, valor, descripcion)
SELECT (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1),
       'operaciones', 'tarifa_revalidacion_umbral_pct', to_jsonb(5),
       'Delta % tolerado al revalidar tarifa antes de bloquear conversión a embarque'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE categoria='operaciones' AND clave='tarifa_revalidacion_umbral_pct')
  AND EXISTS (SELECT 1 FROM public.organizations);

INSERT INTO public.configuracion (organization_id, categoria, clave, valor, descripcion)
SELECT (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1),
       'operaciones', 'tarifa_revalidacion_bloquea_si_vencida', to_jsonb(true),
       'Bloquear creación de embarque si la tarifa cotizada está vencida, hasta re-aprobación de ventas'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE categoria='operaciones' AND clave='tarifa_revalidacion_bloquea_si_vencida')
  AND EXISTS (SELECT 1 FROM public.organizations);

-- 4) RPC revalidar_tarifa_cotizacion
CREATE OR REPLACE FUNCTION public.revalidar_tarifa_cotizacion(p_cotizacion_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id<>v_caller_org THEN
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
      'motivo','sin_tarifa_vinculada');
  END IF;

  SELECT * INTO v_tarifa_vig_rec FROM public.costeo_tarifas_vigentes_v WHERE id=v_cot.tarifa_id LIMIT 1;
  v_tarifa_vigente := FOUND;

  FOR v_costo IN
    SELECT cc.concepto, cc.moneda, cc.costo_unitario AS monto_anterior, cc.costeo_tarifa_recargo_id
    FROM public.cotizacion_costos cc
    WHERE cc.cotizacion_id=v_cot.id AND cc.deleted_at IS NULL
      AND cc.costeo_tarifa_recargo_id IS NOT NULL
  LOOP
    SELECT monto INTO v_monto_actual FROM public.costeo_tarifa_recargos WHERE id=v_costo.costeo_tarifa_recargo_id;
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

  IF NOT v_tarifa_vigente AND v_bloquea_vencida THEN v_severidad := 'bloqueante';
  ELSIF jsonb_array_length(v_cambios)=0 AND v_tarifa_vigente THEN v_severidad := 'sin_cambios';
  ELSIF v_max_delta_pct > v_umbral_pct THEN v_severidad := 'bloqueante';
  ELSE v_severidad := 'informativa';
  END IF;

  RETURN jsonb_build_object(
    'tarifa_vigente',v_tarifa_vigente,'agente_sin_cupo',FALSE,'severidad',v_severidad,
    'cambios',v_cambios,'umbral_pct',v_umbral_pct,'max_delta_pct',v_max_delta_pct,
    'tarifa_id_vigente',CASE WHEN v_tarifa_vigente THEN v_cot.tarifa_id ELSE NULL END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revalidar_tarifa_cotizacion(UUID) TO authenticated, service_role;

-- 5) RPC overload con decisión
CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(
  p_cotizacion_id UUID, p_decision TEXT DEFAULT 'sin_cambios',
  p_tarifa_id_aplicada UUID DEFAULT NULL, p_delta_jsonb JSONB DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_embarque_id UUID;
  v_cot         public.cotizaciones%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('sin_cambios','mantenida_por_operaciones','refrescada','sustituida','reaprobada_ventas') THEN
    RAISE EXCEPTION 'Decisión de tarifa inválida: %', p_decision USING ERRCODE='P0001';
  END IF;
  v_embarque_id := public.crear_embarque_borrador_desde_cotizacion(p_cotizacion_id);
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;

  UPDATE public.embarques
  SET tarifa_id_original = v_cot.tarifa_id,
      tarifa_id_aplicada = COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
      tarifa_delta_jsonb = p_delta_jsonb,
      tarifa_decision    = p_decision,
      tarifa_revalidada_en  = now(),
      tarifa_revalidada_por = auth.uid()
  WHERE id = v_embarque_id;

  INSERT INTO public.bitacora_actividad (
    organization_id,usuario_id,usuario_email,modulo,accion,entidad_id,entidad_nombre,detalles
  ) SELECT v_cot.organization_id, auth.uid(),
         COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
         'Embarques','tarifa_decision_aplicada', v_embarque_id, v_cot.folio,
         jsonb_build_object('decision',p_decision,
           'tarifa_id_original',v_cot.tarifa_id,
           'tarifa_id_aplicada',COALESCE(p_tarifa_id_aplicada,v_cot.tarifa_id),
           'delta',p_delta_jsonb);
  RETURN v_embarque_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_embarque_borrador_desde_cotizacion(UUID,TEXT,UUID,JSONB) TO authenticated, service_role;

-- 6) RPC solicitar_reaprobacion_tarifa
CREATE OR REPLACE FUNCTION public.solicitar_reaprobacion_tarifa(
  p_cotizacion_id UUID, p_delta_jsonb JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cot         public.cotizaciones%ROWTYPE;
  v_caller_org  UUID := current_user_org_id();
  v_is_super    BOOLEAN := has_role(auth.uid(),'super_admin'::app_role);
  v_operador_id UUID;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id<>v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  UPDATE public.cotizaciones
  SET estado_revalidacion='pendiente_reaprobacion',
      revalidacion_solicitada_en=now(),
      revalidacion_resuelta_en=NULL,
      revalidacion_delta_jsonb=p_delta_jsonb,
      updated_at=now()
  WHERE id=p_cotizacion_id;

  BEGIN v_operador_id := v_cot.operador::uuid;
  EXCEPTION WHEN others THEN v_operador_id := NULL; END;

  IF v_operador_id IS NOT NULL THEN
    INSERT INTO public.notificaciones_internas(
      organization_id,usuario_id,tipo,titulo,mensaje,enlace,entidad_tipo,entidad_id)
    VALUES (v_cot.organization_id, v_operador_id,'tarifa_reaprobacion_requerida',
            'Cotización requiere re-aprobación de tarifa',
            'La cotización '||v_cot.folio||' tiene cambios en la tarifa vigente. Revisa y decide.',
            '/cotizaciones/'||v_cot.id::text,'cotizacion',v_cot.id);
  END IF;

  INSERT INTO public.bitacora_actividad(
    organization_id,usuario_id,usuario_email,modulo,accion,entidad_id,entidad_nombre,detalles)
  SELECT v_cot.organization_id, auth.uid(),
         COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
         'Cotizaciones','reaprobacion_solicitada', v_cot.id, v_cot.folio,
         jsonb_build_object('delta',p_delta_jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.solicitar_reaprobacion_tarifa(UUID,JSONB) TO authenticated, service_role;

-- 7) RPC resolver_reaprobacion_tarifa
CREATE OR REPLACE FUNCTION public.resolver_reaprobacion_tarifa(
  p_cotizacion_id UUID, p_decision TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cot        public.cotizaciones%ROWTYPE;
  v_caller_org UUID := current_user_org_id();
  v_is_super   BOOLEAN := has_role(auth.uid(),'super_admin'::app_role);
BEGIN
  IF p_decision NOT IN ('reaprobada','rechazada') THEN
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
