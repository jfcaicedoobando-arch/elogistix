-- ============================================================================
-- FASE R.8 — Fixes auditoría ronda 5 (REG-1, REG-2, N-3)
-- ============================================================================

-- ============================================================================
-- 1) FIX REG-1: R.6 bloqueaba TODA conversión con cualquier drift y overload
-- con decisión era código muerto → deadlock. Nueva lógica:
--   * Guarda solo bloquea severidad 'bloqueante'.
--   * Cortocircuito si estado_revalidacion='reaprobada'.
--   * Overload 4-arg con decisión ≠ 'sin_cambios' ES la resolución.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_revalidacion_sin_cambios(p_cotizacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_res jsonb;
  v_sev text;
  v_estado_rev text;
BEGIN
  SELECT estado_revalidacion INTO v_estado_rev
  FROM public.cotizaciones WHERE id = p_cotizacion_id;

  IF v_estado_rev = 'reaprobada' THEN
    RETURN;
  END IF;

  v_res := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
  v_sev := v_res->>'severidad';

  IF v_sev = 'bloqueante' THEN
    RAISE EXCEPTION 'LC_TARIFA_REQUIERE_REVALIDACION severidad=% max_delta_pct=% — resuelve la revalidación (reaprobación o decisión de tarifa) antes de convertir',
      v_sev, COALESCE(v_res->>'max_delta_pct','0')
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_revalidacion_sin_cambios(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_revalidacion_sin_cambios(uuid) TO authenticated, service_role;

-- Núcleo de creación (cuerpo del 1-arg previo, sin guarda) -------------------
CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_core(p_cotizacion_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cot           public.cotizaciones%ROWTYPE;
  v_caller_org    uuid := current_user_org_id();
  v_is_super      boolean := has_role(auth.uid(), 'super_admin'::app_role);
  v_can_write     boolean;
  v_expediente    text;
  v_embarque_id   uuid;
  v_num           integer;
  v_peso_each     numeric;
  v_vol_each      numeric;
  v_piezas_base   integer;
  v_piezas_rest   integer;
  v_piezas_este   integer;
  v_first_hijo_id uuid;
  v_user_email    text;
  i               integer;
  v_costo         public.cotizacion_costos%ROWTYPE;
  v_target_ids    uuid[];
  v_cid           uuid;
  v_venta         jsonb;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_is_super AND v_cot.organization_id <> v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  v_can_write := v_is_super
                 OR has_role(auth.uid(), 'admin'::app_role)
                 OR has_role(auth.uid(), 'operador'::app_role);
  IF NOT v_can_write THEN
    RAISE EXCEPTION 'Solo admin u operador pueden crear el borrador' USING ERRCODE = '42501';
  END IF;

  IF v_cot.estado <> 'Aceptada'::estado_cotizacion THEN
    RAISE EXCEPTION 'La cotización debe estar en estado Aceptada (actual: %)', v_cot.estado USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.cliente_id IS NULL OR v_cot.es_prospecto THEN
    RAISE EXCEPTION 'Convierte el prospecto a cliente antes de crear el borrador' USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.embarque_id IS NOT NULL THEN
    RETURN v_cot.embarque_id;
  END IF;

  v_expediente := public.generar_expediente(v_cot.tipo::text);

  INSERT INTO public.embarques (
    cotizacion_id, expediente, cliente_id, cliente_nombre,
    estado, modo, tipo, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas, operador, tipo_carga, tipo_contenedor,
    organization_id
  )
  VALUES (
    v_cot.id, v_expediente, v_cot.cliente_id, v_cot.cliente_nombre,
    'Borrador'::estado_embarque, v_cot.modo, v_cot.tipo, v_cot.incoterm, v_cot.descripcion_mercancia,
    COALESCE(v_cot.peso_kg, 0), COALESCE(v_cot.volumen_m3, 0), COALESCE(v_cot.piezas, 0),
    v_cot.operador, v_cot.tipo_carga, v_cot.tipo_contenedor,
    v_cot.organization_id
  )
  RETURNING id INTO v_embarque_id;

  v_num := GREATEST(1, COALESCE(v_cot.num_contenedores, 1));
  v_peso_each := COALESCE(v_cot.peso_kg, 0) / v_num;
  v_vol_each := COALESCE(v_cot.volumen_m3, 0) / v_num;
  v_piezas_base := COALESCE(v_cot.piezas, 0) / v_num;
  v_piezas_rest := COALESCE(v_cot.piezas, 0);

  v_target_ids := ARRAY[]::uuid[];
  FOR i IN 1..v_num LOOP
    IF i = v_num THEN
      v_piezas_este := v_piezas_rest;
    ELSE
      v_piezas_este := v_piezas_base;
    END IF;
    v_piezas_rest := v_piezas_rest - v_piezas_este;

    INSERT INTO public.embarque_contenedores (
      embarque_id, numero_contenedor, tipo_contenedor, bl_house,
      peso_kg, volumen_m3, piezas, orden
    )
    VALUES (
      v_embarque_id, '', COALESCE(v_cot.tipo_contenedor, ''), '',
      v_peso_each, v_vol_each, v_piezas_este, i
    )
    RETURNING id INTO v_cid;

    v_target_ids := array_append(v_target_ids, v_cid);
    IF i = 1 THEN
      v_first_hijo_id := v_cid;
    END IF;
  END LOOP;

  FOR v_costo IN
    SELECT * FROM public.cotizacion_costos
    WHERE cotizacion_id = v_cot.id AND deleted_at IS NULL
  LOOP
    IF COALESCE(v_costo.unidad_medida, 'Contenedor') = 'BL' THEN
      INSERT INTO public.conceptos_costo (
        embarque_id, contenedor_id, concepto, monto, moneda,
        proveedor_nombre, organization_id
      )
      VALUES (
        v_embarque_id, NULL, v_costo.concepto, COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
        CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
        COALESCE(v_costo.proveedor, ''), v_cot.organization_id
      );
    ELSE
      FOREACH v_cid IN ARRAY v_target_ids LOOP
        INSERT INTO public.conceptos_costo (
          embarque_id, contenedor_id, concepto, monto, moneda,
          proveedor_nombre, organization_id
        )
        VALUES (
          v_embarque_id, v_cid, v_costo.concepto, COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
          CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
          COALESCE(v_costo.proveedor, ''), v_cot.organization_id
        );
      END LOOP;
    END IF;
  END LOOP;

  IF jsonb_typeof(v_cot.conceptos_venta) = 'array' THEN
    FOR v_venta IN SELECT * FROM jsonb_array_elements(v_cot.conceptos_venta)
    LOOP
      IF COALESCE(trim(v_venta->>'descripcion'), '') <> '' THEN
        INSERT INTO public.conceptos_venta (
          embarque_id, descripcion, cantidad, precio_unitario, moneda, aplica_iva, total, organization_id
        )
        VALUES (
          v_embarque_id,
          v_venta->>'descripcion',
          COALESCE((v_venta->>'cantidad')::integer, 1),
          COALESCE((v_venta->>'precio_unitario')::numeric, 0),
          CASE WHEN v_venta->>'moneda' = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
          COALESCE((v_venta->>'aplica_iva')::boolean, false),
          COALESCE((v_venta->>'total')::numeric, 0),
          v_cot.organization_id
        );
      END IF;
    END LOOP;
  END IF;

  UPDATE public.cotizaciones
  SET embarque_id = v_embarque_id, updated_at = now()
  WHERE id = v_cot.id;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, modulo, accion,
    entidad_id, entidad_nombre, detalles
  )
  VALUES (
    v_cot.organization_id, auth.uid(), COALESCE(v_user_email, ''),
    'Cotizaciones', 'Borrador de embarque creado',
    v_cot.id, v_cot.folio,
    jsonb_build_object('embarque_id', v_embarque_id, 'expediente', v_expediente)
  );

  INSERT INTO public.notificaciones_internas (
    organization_id, usuario_id, tipo, titulo, mensaje, enlace
  )
  SELECT
    v_cot.organization_id,
    om.user_id,
    'cotizacion_borrador_embarque',
    'Borrador de embarque creado',
    'Se generó el borrador ' || v_expediente || ' desde la cotización ' || v_cot.folio,
    '/embarques/' || v_embarque_id::text
  FROM public.organization_members om
  WHERE om.organization_id = v_cot.organization_id
    AND om.role IN ('admin'::app_role, 'operador'::app_role)
    AND om.user_id <> auth.uid();

  RETURN v_embarque_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_embarque_borrador_core(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_embarque_borrador_core(uuid) TO service_role;

-- 1-arg público: guarda + núcleo (conversión directa) -----------------------
CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(p_cotizacion_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.enforce_revalidacion_sin_cambios(p_cotizacion_id);
  RETURN public.crear_embarque_borrador_core(p_cotizacion_id);
END;
$$;

-- Overload con decisión: la decisión explícita ES la resolución -------------
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

  IF p_decision = 'sin_cambios' THEN
    PERFORM public.enforce_revalidacion_sin_cambios(p_cotizacion_id);
  END IF;

  v_embarque_id := public.crear_embarque_borrador_core(p_cotizacion_id);
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;

  UPDATE public.embarques
  SET tarifa_id_original = v_cot.tarifa_id,
      tarifa_id_aplicada = COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
      tarifa_delta_jsonb = p_delta_jsonb,
      tarifa_decision    = p_decision,
      tarifa_revalidada_en  = now(),
      tarifa_revalidada_por = auth.uid()
  WHERE id = v_embarque_id;

  IF p_decision <> 'sin_cambios' AND v_cot.estado_revalidacion = 'pendiente_reaprobacion' THEN
    UPDATE public.cotizaciones
    SET estado_revalidacion = 'reaprobada',
        revalidacion_resuelta_en = now(),
        updated_at = now()
    WHERE id = p_cotizacion_id;
  END IF;

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

-- ============================================================================
-- 2) FIX REG-2: monto_aplicado_factura recalculado en DB (espejo de Fase L CxP)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_pagos_factura_monto_convertido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fact_moneda public.moneda;
  v_fact_tc     numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT moneda, tipo_cambio INTO v_fact_moneda, v_fact_tc
  FROM public.facturas
  WHERE id = NEW.factura_id;

  IF v_fact_moneda IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_NO_ENCONTRADA: factura % no existe', NEW.factura_id
      USING ERRCODE = 'P0002';
  END IF;

  NEW.monto_aplicado_factura := public.convertir_monto_pago_a_factura(
    NEW.monto,
    NEW.moneda,
    CASE WHEN NEW.moneda <> v_fact_moneda AND NEW.tipo_cambio = 1
         THEN NULL ELSE NEW.tipo_cambio END,
    v_fact_moneda,
    v_fact_tc
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagos_factura_monto_convertido ON public.pagos_factura;
CREATE TRIGGER trg_pagos_factura_monto_convertido
  BEFORE INSERT OR UPDATE OF monto, moneda, tipo_cambio, factura_id
  ON public.pagos_factura
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pagos_factura_monto_convertido();

-- Backfill: recalcular pagos con cruce de monedas ---------------------------
DO $$
DECLARE
  r      record;
  v_ok   int := 0;
  v_skip int := 0;
BEGIN
  FOR r IN
    SELECT pf.id, pf.monto, pf.moneda, pf.tipo_cambio,
           f.moneda AS fact_moneda, f.tipo_cambio AS fact_tc
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND pf.moneda <> f.moneda
  LOOP
    BEGIN
      UPDATE public.pagos_factura pf2
      SET monto_aplicado_factura = public.convertir_monto_pago_a_factura(
            r.monto, r.moneda,
            NULLIF(NULLIF(r.tipo_cambio, 0), 1),
            r.fact_moneda, NULLIF(r.fact_tc, 0))
      WHERE pf2.id = r.id;
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_skip := v_skip + 1;
      RAISE WARNING 'pago % no migrado (%): revisar TC manualmente', r.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'backfill monto_aplicado_factura: % actualizados, % omitidos', v_ok, v_skip;
END $$;

-- ============================================================================
-- 3) FIX N-3: comisiones Devengadas quedan en CFDI muerto tras cancelar/sustituir
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_factura_cancelada_comisiones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado IN ('Cancelada','Sustituida')
     AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    UPDATE public.comisiones_devengadas
    SET estado = 'Cancelada',
        nota = trim(both ' ' FROM
              COALESCE(nota,'') || ' [auto] factura ' || NEW.estado::text ||
              ' (núm. ' || COALESCE(NEW.numero, NEW.id::text) || ')'),
        updated_at = now()
    WHERE factura_id = NEW.id
      AND estado = 'Devengada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_factura_cancelada_comisiones ON public.facturas;
CREATE TRIGGER trg_factura_cancelada_comisiones
  AFTER UPDATE OF estado ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_factura_cancelada_comisiones();