
-- =========================================================================
-- BLOQUE 3 — Integridad financiera y esquema
-- =========================================================================

-- FIX-BL-11 · Quitar DEFAULT de tipo de cambio en embarques.
ALTER TABLE public.embarques ALTER COLUMN tipo_cambio_usd DROP DEFAULT;
ALTER TABLE public.embarques ALTER COLUMN tipo_cambio_eur DROP DEFAULT;

-- Reescritura de los dos overloads de crear_embarque_completo:
-- ya no forzamos 17.5/19.0 cuando el caller no manda TC.
CREATE OR REPLACE FUNCTION public.crear_embarque_completo(
  p_embarque jsonb,
  p_conceptos_venta jsonb DEFAULT '[]'::jsonb,
  p_conceptos_costo jsonb DEFAULT '[]'::jsonb,
  p_documentos jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  nuevo_id uuid := gen_random_uuid();
  v_org_id uuid;
  cv jsonb; cc jsonb; doc jsonb;
BEGIN
  v_org_id := current_user_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization context for caller';
  END IF;

  INSERT INTO embarques (
    id, expediente, cliente_id, cliente_nombre, modo, tipo,
    shipper, consignatario, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas,
    puerto_origen, puerto_destino, naviera, agente, naviera_id, agente_id,
    bl_master, bl_house, tipo_servicio, contenedor, tipo_contenedor,
    aeropuerto_origen, aeropuerto_destino, aerolinea,
    mawb, hawb, ciudad_origen, ciudad_destino,
    transportista, carta_porte, etd, eta,
    tipo_cambio_usd, tipo_cambio_eur,
    tipo_carga, msds_archivo, operador, organization_id
  ) VALUES (
    nuevo_id, p_embarque->>'expediente', (p_embarque->>'cliente_id')::uuid,
    COALESCE(p_embarque->>'cliente_nombre',''),
    (p_embarque->>'modo')::modo_transporte, (p_embarque->>'tipo')::tipo_operacion,
    COALESCE(p_embarque->>'shipper',''), COALESCE(p_embarque->>'consignatario',''),
    COALESCE((p_embarque->>'incoterm')::incoterm,'FOB'),
    COALESCE(p_embarque->>'descripcion_mercancia',''),
    COALESCE((p_embarque->>'peso_kg')::numeric,0),
    COALESCE((p_embarque->>'volumen_m3')::numeric,0),
    COALESCE((p_embarque->>'piezas')::int,0),
    p_embarque->>'puerto_origen', p_embarque->>'puerto_destino',
    p_embarque->>'naviera', p_embarque->>'agente',
    NULLIF(p_embarque->>'naviera_id','')::uuid, NULLIF(p_embarque->>'agente_id','')::uuid,
    p_embarque->>'bl_master', p_embarque->>'bl_house',
    CASE WHEN p_embarque->>'tipo_servicio' IS NOT NULL THEN (p_embarque->>'tipo_servicio')::tipo_servicio_maritimo END,
    p_embarque->>'contenedor', p_embarque->>'tipo_contenedor',
    p_embarque->>'aeropuerto_origen', p_embarque->>'aeropuerto_destino',
    p_embarque->>'aerolinea', p_embarque->>'mawb', p_embarque->>'hawb',
    p_embarque->>'ciudad_origen', p_embarque->>'ciudad_destino',
    p_embarque->>'transportista', p_embarque->>'carta_porte',
    CASE WHEN p_embarque->>'etd' IS NOT NULL THEN (p_embarque->>'etd')::date END,
    CASE WHEN p_embarque->>'eta' IS NOT NULL THEN (p_embarque->>'eta')::date END,
    -- FIX-BL-11: sin default; NULL si no viene.
    NULLIF(p_embarque->>'tipo_cambio_usd','')::numeric,
    NULLIF(p_embarque->>'tipo_cambio_eur','')::numeric,
    COALESCE(p_embarque->>'tipo_carga','Carga General'),
    p_embarque->>'msds_archivo', COALESCE(p_embarque->>'operador',''),
    v_org_id
  );

  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    VALUES (nuevo_id, cv->>'descripcion', (cv->>'cantidad')::int, (cv->>'precio_unitario')::numeric,
            (cv->>'moneda')::moneda, (cv->>'total')::numeric, v_org_id);
  END LOOP;
  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo) LOOP
    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, organization_id)
    VALUES (nuevo_id, cc->>'concepto', COALESCE(cc->>'proveedor_nombre',''),
      CASE WHEN cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' <> '' THEN (cc->>'proveedor_id')::uuid END,
      (cc->>'moneda')::moneda, (cc->>'monto')::numeric, v_org_id);
  END LOOP;
  FOR doc IN SELECT * FROM jsonb_array_elements(p_documentos) LOOP
    INSERT INTO documentos_embarque (embarque_id, nombre, archivo, estado, organization_id)
    VALUES (nuevo_id, doc->>'nombre', NULLIF(doc->>'archivo',''),
      CASE WHEN NULLIF(doc->>'archivo','') IS NOT NULL THEN 'Recibido'::estado_documento ELSE 'Pendiente'::estado_documento END,
      v_org_id);
  END LOOP;
  INSERT INTO notas_embarque (embarque_id, contenido, tipo, organization_id)
  VALUES (nuevo_id, 'Embarque creado', 'sistema', v_org_id);

  RETURN jsonb_build_object('id', nuevo_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.crear_embarque_completo(
  p_embarque jsonb,
  p_conceptos_venta jsonb DEFAULT '[]'::jsonb,
  p_conceptos_costo jsonb DEFAULT '[]'::jsonb,
  p_documentos jsonb DEFAULT '[]'::jsonb,
  p_request_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  nuevo_id uuid := gen_random_uuid();
  v_org_id uuid; v_resp jsonb;
  cv jsonb; cc jsonb; doc jsonb;
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'crear_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  v_org_id := current_user_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'No organization context for caller'; END IF;
  PERFORM public._assert_writer(v_org_id);

  INSERT INTO embarques (
    id, expediente, cliente_id, cliente_nombre, modo, tipo,
    shipper, consignatario, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas,
    puerto_origen, puerto_destino, naviera, agente,
    bl_master, bl_house, tipo_servicio, contenedor, tipo_contenedor,
    aeropuerto_origen, aeropuerto_destino, aerolinea,
    mawb, hawb, ciudad_origen, ciudad_destino,
    transportista, carta_porte, etd, eta,
    tipo_cambio_usd, tipo_cambio_eur,
    tipo_carga, msds_archivo, operador, organization_id, cotizacion_id
  ) VALUES (
    nuevo_id, p_embarque->>'expediente', (p_embarque->>'cliente_id')::uuid,
    COALESCE(p_embarque->>'cliente_nombre',''),
    (p_embarque->>'modo')::modo_transporte, (p_embarque->>'tipo')::tipo_operacion,
    COALESCE(p_embarque->>'shipper',''), COALESCE(p_embarque->>'consignatario',''),
    COALESCE((p_embarque->>'incoterm')::incoterm,'FOB'),
    COALESCE(p_embarque->>'descripcion_mercancia',''),
    COALESCE((p_embarque->>'peso_kg')::numeric,0),
    COALESCE((p_embarque->>'volumen_m3')::numeric,0),
    COALESCE((p_embarque->>'piezas')::int,0),
    p_embarque->>'puerto_origen', p_embarque->>'puerto_destino',
    p_embarque->>'naviera', p_embarque->>'agente',
    p_embarque->>'bl_master', p_embarque->>'bl_house',
    CASE WHEN p_embarque->>'tipo_servicio' IS NOT NULL THEN (p_embarque->>'tipo_servicio')::tipo_servicio_maritimo END,
    p_embarque->>'contenedor', p_embarque->>'tipo_contenedor',
    p_embarque->>'aeropuerto_origen', p_embarque->>'aeropuerto_destino',
    p_embarque->>'aerolinea', p_embarque->>'mawb', p_embarque->>'hawb',
    p_embarque->>'ciudad_origen', p_embarque->>'ciudad_destino',
    p_embarque->>'transportista', p_embarque->>'carta_porte',
    CASE WHEN p_embarque->>'etd' IS NOT NULL THEN (p_embarque->>'etd')::date END,
    CASE WHEN p_embarque->>'eta' IS NOT NULL THEN (p_embarque->>'eta')::date END,
    -- FIX-BL-11: sin default.
    NULLIF(p_embarque->>'tipo_cambio_usd','')::numeric,
    NULLIF(p_embarque->>'tipo_cambio_eur','')::numeric,
    COALESCE(p_embarque->>'tipo_carga','Carga General'),
    p_embarque->>'msds_archivo', COALESCE(p_embarque->>'operador',''),
    v_org_id,
    CASE WHEN p_embarque->>'cotizacion_id' IS NOT NULL AND p_embarque->>'cotizacion_id' <> '' THEN (p_embarque->>'cotizacion_id')::uuid END
  );

  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    VALUES (nuevo_id, cv->>'descripcion', (cv->>'cantidad')::int, (cv->>'precio_unitario')::numeric,
            (cv->>'moneda')::moneda, (cv->>'total')::numeric, v_org_id);
  END LOOP;
  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo) LOOP
    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, organization_id)
    VALUES (nuevo_id, cc->>'concepto', COALESCE(cc->>'proveedor_nombre',''),
      CASE WHEN cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' <> '' THEN (cc->>'proveedor_id')::uuid END,
      (cc->>'moneda')::moneda, (cc->>'monto')::numeric, v_org_id);
  END LOOP;
  FOR doc IN SELECT * FROM jsonb_array_elements(p_documentos) LOOP
    INSERT INTO documentos_embarque (embarque_id, nombre, archivo, estado, organization_id)
    VALUES (nuevo_id, doc->>'nombre', NULLIF(doc->>'archivo',''),
      CASE WHEN NULLIF(doc->>'archivo','') IS NOT NULL THEN 'Recibido'::estado_documento ELSE 'Pendiente'::estado_documento END,
      v_org_id);
  END LOOP;
  INSERT INTO notas_embarque (embarque_id, contenido, tipo, organization_id)
  VALUES (nuevo_id, 'Embarque creado', 'sistema', v_org_id);

  v_resp := jsonb_build_object('id', nuevo_id);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

-- =========================================================================
-- FIX-BL-13 · Guard de sobrepago vía trigger (CxC + CxP)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.tg_pago_factura_no_sobrepago()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_saldo numeric;
  v_delta numeric;
BEGIN
  -- Solo aplicamos si el pago es "vivo".
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN
    v_delta := COALESCE(NEW.monto_aplicado_factura,0) - COALESCE(OLD.monto_aplicado_factura,0);
  ELSE
    v_delta := COALESCE(NEW.monto_aplicado_factura,0);
  END IF;

  IF v_delta <= 0 THEN RETURN NEW; END IF;

  -- saldo_factura devuelve total - pagos_vigentes - NC.
  -- Al momento del BEFORE, OLD ya está descontado en saldo si es UPDATE.
  SELECT public.saldo_factura(NEW.factura_id) INTO v_saldo;
  IF TG_OP = 'UPDATE' THEN
    v_saldo := v_saldo + COALESCE(OLD.monto_aplicado_factura,0);
  END IF;

  IF v_delta > v_saldo + 0.005 THEN
    RAISE EXCEPTION 'LC_PAGO_EXCEDE_SALDO: pago % excede el saldo disponible % de la factura',
      round(v_delta,2), round(v_saldo,2)
      USING ERRCODE='P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tg_pagos_factura_no_sobrepago ON public.pagos_factura;
CREATE TRIGGER tg_pagos_factura_no_sobrepago
  BEFORE INSERT OR UPDATE ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public.tg_pago_factura_no_sobrepago();

CREATE OR REPLACE FUNCTION public.tg_pago_proveedor_no_sobrepago()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_subtotal numeric; v_ncs numeric; v_pagos numeric;
  v_saldo numeric; v_delta numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN
    v_delta := COALESCE(NEW.monto_en_moneda_factura,0) - COALESCE(OLD.monto_en_moneda_factura,0);
  ELSE
    v_delta := COALESCE(NEW.monto_en_moneda_factura,0);
  END IF;

  IF v_delta <= 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(subtotal,0) INTO v_subtotal
  FROM public.proveedor_facturas WHERE id = NEW.proveedor_factura_id;

  SELECT COALESCE(SUM(monto),0) INTO v_ncs
  FROM public.proveedor_notas_credito
  WHERE proveedor_factura_id = NEW.proveedor_factura_id
    AND deleted_at IS NULL AND estado::text = 'Aplicada';

  SELECT COALESCE(SUM(monto_en_moneda_factura),0) INTO v_pagos
  FROM public.pagos_proveedor
  WHERE proveedor_factura_id = NEW.proveedor_factura_id
    AND deleted_at IS NULL
    AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

  v_saldo := v_subtotal - v_ncs - v_pagos;

  IF v_delta > v_saldo + 0.005 THEN
    RAISE EXCEPTION 'LC_PAGO_EXCEDE_SALDO: pago % excede el saldo disponible % de la factura de proveedor',
      round(v_delta,2), round(v_saldo,2)
      USING ERRCODE='P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tg_pagos_proveedor_no_sobrepago ON public.pagos_proveedor;
CREATE TRIGGER tg_pagos_proveedor_no_sobrepago
  BEFORE INSERT OR UPDATE ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.tg_pago_proveedor_no_sobrepago();

COMMENT ON FUNCTION public.tg_pago_factura_no_sobrepago() IS
  'BL-13 impide que un pago (o edición) deje el saldo negativo; tolerancia 0.005 para redondeo.';
COMMENT ON FUNCTION public.tg_pago_proveedor_no_sobrepago() IS
  'BL-13 impide sobrepago en pagos_proveedor; tolerancia 0.005.';
