-- Ola 8 · Remediación v15 (candados de base de datos)
-- Registro en repositorio de los cambios ya aplicados en la base:
--   M-14 _assert_tc_banda + triggers en pagos_factura / pagos_proveedor (banda 5-40).
--   M-15 credito_en_uso_mxn: exposición a crédito calculada del lado del servidor.
--   B-12 crear_embarque_completo rechaza pesos/piezas negativos.
--   B-6  registrar_traspaso_bancario es fail-closed cuando el saldo es desconocido.

-- ==== _assert_tc_banda
CREATE OR REPLACE FUNCTION public._assert_tc_banda()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tc numeric;
BEGIN
  v_tc := CASE WHEN TG_TABLE_NAME = 'pagos_proveedor' THEN NEW.tipo_cambio_usd ELSE NEW.tipo_cambio END;
  IF NEW.moneda::text <> 'MXN' AND v_tc IS NOT NULL AND (v_tc < 5 OR v_tc > 40) THEN
    RAISE EXCEPTION 'LC_TC_FUERA_DE_BANDA: el tipo de cambio % no es plausible (se esperan entre 5 y 40 pesos por dólar/euro).', v_tc
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$
;
-- ==== credito_en_uso_mxn
CREATE OR REPLACE FUNCTION public.credito_en_uso_mxn(p_cliente_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH fc AS (
    SELECT f.id, f.total, f.moneda::text AS moneda, COALESCE(NULLIF(f.tipo_cambio, 0), 1) AS tc
    FROM public.facturas f
    WHERE f.cliente_id = p_cliente_id
      AND f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida', 'Vencida', 'Parcialmente pagada')
  ),
  pagos AS (
    SELECT p.factura_id, COALESCE(SUM(p.monto_aplicado_factura), 0) AS pagado
    FROM public.pagos_factura p
    WHERE p.deleted_at IS NULL AND p.factura_id IN (SELECT id FROM fc)
    GROUP BY p.factura_id
  ),
  ncs AS (
    SELECT n.factura_id, COALESCE(SUM(n.monto), 0) AS nc
    FROM public.factura_notas_credito n
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
      AND n.factura_id IN (SELECT id FROM fc)
    GROUP BY n.factura_id
  )
  SELECT ROUND(COALESCE(SUM(
    GREATEST(0, COALESCE(fc.total, 0) - COALESCE(p.pagado, 0) - COALESCE(n.nc, 0))
      * CASE WHEN fc.moneda = 'MXN' THEN 1 ELSE fc.tc END
  ), 0), 2)
  FROM fc
  LEFT JOIN pagos p ON p.factura_id = fc.id
  LEFT JOIN ncs n ON n.factura_id = fc.id
$function$
;
-- ==== crear_embarque_completo
CREATE OR REPLACE FUNCTION public.crear_embarque_completo(p_embarque jsonb, p_conceptos_venta jsonb DEFAULT '[]'::jsonb, p_conceptos_costo jsonb DEFAULT '[]'::jsonb, p_documentos jsonb DEFAULT '[]'::jsonb, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_id uuid := gen_random_uuid();
  v_org_id uuid; v_resp jsonb;
  cv jsonb; cc jsonb; doc jsonb;
BEGIN
  PERFORM public._assert_medidas_embarque(p_embarque);
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
    -- FIX-BL-11: sin default. 13.334.6: 0 también cuenta como "sin dato"
    -- (el CHECK `embarques_tc_*_pos` exige > 0).
    NULLIF(NULLIF(p_embarque->>'tipo_cambio_usd','')::numeric, 0),
    NULLIF(NULLIF(p_embarque->>'tipo_cambio_eur','')::numeric, 0),
    COALESCE(p_embarque->>'tipo_carga','Carga General'),
    p_embarque->>'msds_archivo', COALESCE(p_embarque->>'operador',''),
    v_org_id,
    CASE WHEN p_embarque->>'cotizacion_id' IS NOT NULL AND p_embarque->>'cotizacion_id' <> '' THEN (p_embarque->>'cotizacion_id')::uuid END
  );
  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    VALUES (nuevo_id, cv->>'descripcion', (cv->>'cantidad')::numeric, (cv->>'precio_unitario')::numeric,
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
$function$
;
CREATE OR REPLACE FUNCTION public.crear_embarque_completo(p_embarque jsonb, p_conceptos_venta jsonb DEFAULT '[]'::jsonb, p_conceptos_costo jsonb DEFAULT '[]'::jsonb, p_documentos jsonb DEFAULT '[]'::jsonb, p_request_id uuid DEFAULT NULL::uuid, p_contenedores jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_id uuid := gen_random_uuid();
  v_org_id uuid; v_resp jsonb;
  cv jsonb; cc jsonb; doc jsonb; ct jsonb;
BEGIN
  PERFORM public._assert_medidas_embarque(p_embarque);
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
    NULLIF(NULLIF(p_embarque->>'tipo_cambio_usd','')::numeric, 0),
    NULLIF(NULLIF(p_embarque->>'tipo_cambio_eur','')::numeric, 0),
    COALESCE(p_embarque->>'tipo_carga','Carga General'),
    p_embarque->>'msds_archivo', COALESCE(p_embarque->>'operador',''),
    v_org_id,
    CASE WHEN p_embarque->>'cotizacion_id' IS NOT NULL AND p_embarque->>'cotizacion_id' <> '' THEN (p_embarque->>'cotizacion_id')::uuid END
  );
  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    VALUES (nuevo_id, cv->>'descripcion', (cv->>'cantidad')::numeric, (cv->>'precio_unitario')::numeric,
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
  -- M-11 (auditoría v14): los contenedores viajaban en una segunda llamada
  -- desde el cliente; si esa llamada fallaba quedaba un embarque FCL sin
  -- contenedores. Ahora entran en la MISMA transacción que el embarque.
  FOR ct IN SELECT * FROM jsonb_array_elements(COALESCE(p_contenedores, '[]'::jsonb)) LOOP
    INSERT INTO embarque_contenedores (
      embarque_id, numero_contenedor, tipo_contenedor, bl_house,
      peso_kg, volumen_m3, piezas, orden, organization_id
    ) VALUES (
      nuevo_id,
      COALESCE(ct->>'numero_contenedor',''),
      COALESCE(ct->>'tipo_contenedor',''),
      NULLIF(ct->>'bl_house',''),
      COALESCE(NULLIF(ct->>'peso_kg','')::numeric, 0),
      COALESCE(NULLIF(ct->>'volumen_m3','')::numeric, 0),
      COALESCE(NULLIF(ct->>'piezas','')::int, 0),
      COALESCE(NULLIF(ct->>'orden','')::int, 1),
      v_org_id
    );
  END LOOP;
  INSERT INTO notas_embarque (embarque_id, contenido, tipo, organization_id)
  VALUES (nuevo_id, 'Embarque creado', 'sistema', v_org_id);
  v_resp := jsonb_build_object('id', nuevo_id);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$
;
-- ==== registrar_traspaso_bancario
CREATE OR REPLACE FUNCTION public.registrar_traspaso_bancario(p_cuenta_origen_id uuid, p_cuenta_destino_id uuid, p_fecha date, p_monto_origen numeric, p_tipo_cambio numeric DEFAULT NULL::numeric, p_comision numeric DEFAULT 0, p_concepto text DEFAULT ''::text, p_referencia text DEFAULT ''::text, p_client_request_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_user_org_id();
  v_uid uuid := auth.uid();
  v_origen public.cuentas_bancarias%ROWTYPE;
  v_destino public.cuentas_bancarias%ROWTYPE;
  v_tc numeric;
  v_comision numeric := COALESCE(p_comision, 0);
  v_monto_destino numeric;
  v_folio text;
  v_org_eff uuid;
  v_id uuid;
  v_saldo_origen numeric;
  v_concepto text := COALESCE(NULLIF(TRIM(p_concepto), ''), 'Traspaso entre cuentas propias');
BEGIN
  IF p_cuenta_origen_id = p_cuenta_destino_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_MISMA_CUENTA: la cuenta origen y destino deben ser distintas';
  END IF;
  IF COALESCE(p_monto_origen, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_MONTO_INVALIDO: el monto debe ser mayor a cero';
  END IF;
  IF v_comision < 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_COMISION_INVALIDA: la comisión no puede ser negativa';
  END IF;
  SELECT * INTO v_origen FROM public.cuentas_bancarias WHERE id = p_cuenta_origen_id;
  SELECT * INTO v_destino FROM public.cuentas_bancarias WHERE id = p_cuenta_destino_id;
  IF v_origen.id IS NULL OR v_destino.id IS NULL THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INEXISTENTE: no se encontró alguna de las cuentas';
  END IF;
  IF v_origen.organization_id <> v_destino.organization_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_ORG_DISTINTA: las cuentas pertenecen a organizaciones diferentes';
  END IF;
  IF NOT v_origen.activa OR NOT v_destino.activa THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INACTIVA: ambas cuentas deben estar activas';
  END IF;
  IF v_origen.moneda = v_destino.moneda THEN
    v_tc := 1;
    v_monto_destino := ROUND(p_monto_origen, 2);
  ELSE
    IF p_tipo_cambio IS NULL OR p_tipo_cambio <= 0 THEN
      RAISE EXCEPTION 'LC_TRASPASO_TC_REQUERIDO: captura el tipo de cambio para un traspaso entre monedas distintas';
    END IF;
    v_tc := p_tipo_cambio;
    v_monto_destino := ROUND(p_monto_origen * v_tc, 2);
  END IF;
  -- B-6 (v14): monto + comisión no pueden exceder el saldo de la cuenta origen.
  v_saldo_origen := COALESCE(public.saldo_cuenta_bancaria(p_cuenta_origen_id), 0);
  IF ROUND(p_monto_origen, 2) + ROUND(v_comision, 2) > ROUND(v_saldo_origen, 2) + 0.005 THEN
    RAISE EXCEPTION 'LC_TRASPASO_SALDO_INSUFICIENTE: el saldo de la cuenta origen (%) no cubre el traspaso más la comisión (%).',
      ROUND(v_saldo_origen, 2), ROUND(p_monto_origen, 2) + ROUND(v_comision, 2)
      USING ERRCODE = '22023';
  END IF;
  v_org_eff := COALESCE(v_org, v_origen.organization_id);
  v_folio := public.siguiente_folio_traspaso(v_org_eff);
  INSERT INTO public.traspasos_bancarios(
    organization_id, folio, cuenta_origen_id, cuenta_destino_id, fecha,
    monto_origen, moneda_origen, monto_destino, moneda_destino,
    tipo_cambio, comision, concepto, referencia, created_by, client_request_id
  ) VALUES (
    v_org_eff, v_folio, p_cuenta_origen_id, p_cuenta_destino_id, p_fecha,
    ROUND(p_monto_origen, 2), v_origen.moneda, v_monto_destino, v_destino.moneda,
    v_tc, ROUND(v_comision, 2), v_concepto, COALESCE(p_referencia, ''), v_uid,
    p_client_request_id
  ) RETURNING id INTO v_id;
  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
    v_concepto || ' → ' || v_destino.banco || ' ' || v_destino.alias, COALESCE(p_referencia, ''),
    ROUND(p_monto_origen, 2), 0, 'traspaso-' || v_id::text || '-origen',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );
  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_destino.organization_id), p_cuenta_destino_id, p_fecha,
    v_concepto || ' ← ' || v_origen.banco || ' ' || v_origen.alias, COALESCE(p_referencia, ''),
    0, v_monto_destino, 'traspaso-' || v_id::text || '-destino',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );
  IF ROUND(v_comision, 2) > 0 THEN
    INSERT INTO public.bbva_movimientos(
      organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
      cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
      importado_por, traspaso_id
    ) VALUES (
      COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
      'Comisión bancaria por traspaso ' || v_folio, COALESCE(p_referencia, ''),
      ROUND(v_comision, 2), 0, 'traspaso-' || v_id::text || '-comision',
      'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
    );
  END IF;
  RETURN v_id;
END;
$function$
;

DROP TRIGGER IF EXISTS trg_tc_banda_pagos_factura ON public.pagos_factura;
CREATE TRIGGER trg_tc_banda_pagos_factura BEFORE INSERT OR UPDATE OF tipo_cambio, moneda ON public.pagos_factura FOR EACH ROW EXECUTE FUNCTION _assert_tc_banda();

DROP TRIGGER IF EXISTS trg_tc_banda_pagos_proveedor ON public.pagos_proveedor;
CREATE TRIGGER trg_tc_banda_pagos_proveedor BEFORE INSERT OR UPDATE OF tipo_cambio_usd, moneda ON public.pagos_proveedor FOR EACH ROW EXECUTE FUNCTION _assert_tc_banda();

REVOKE ALL ON FUNCTION public._assert_tc_banda() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_tc_banda() TO service_role;
REVOKE ALL ON FUNCTION public.credito_en_uso_mxn(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credito_en_uso_mxn(uuid) TO service_role;

-- ── Corrección posterior (misma ola) ────────────────────────────────────────
-- R-2: la sobrecarga de 5 argumentos quedó huérfana (la app siempre manda
-- p_contenedores). Dos firmas con DEFAULTs hacen ambigua la resolución.
DROP FUNCTION IF EXISTS public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid);

-- M-14: el trigger es compartido por pagos_factura (tipo_cambio) y
-- pagos_proveedor (tipo_cambio_usd). Referenciar NEW.<campo> directo falla en
-- la tabla que no tiene esa columna, porque plpgsql resuelve todos los campos
-- del CASE aunque la rama no se ejecute. Se lee vía to_jsonb.
CREATE OR REPLACE FUNCTION public._assert_tc_banda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_row jsonb := to_jsonb(NEW);
  v_tc numeric;
  v_moneda text := v_row->>'moneda';
BEGIN
  v_tc := COALESCE(
    NULLIF(v_row->>'tipo_cambio_usd', '')::numeric,
    NULLIF(v_row->>'tipo_cambio', '')::numeric
  );
  IF v_moneda IS NOT NULL AND v_moneda <> 'MXN'
     AND v_tc IS NOT NULL AND (v_tc < 5 OR v_tc > 40) THEN
    RAISE EXCEPTION
      'LC_TC_FUERA_DE_BANDA: el tipo de cambio (%) está fuera de la banda razonable (5 a 40 MXN por divisa).',
      v_tc
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_tc_banda() FROM PUBLIC, anon, authenticated;

-- B-12: candado de medidas negativas (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'embarques_medidas_no_negativas') THEN
    ALTER TABLE public.embarques
      ADD CONSTRAINT embarques_medidas_no_negativas
      CHECK (COALESCE(peso_kg, 0) >= 0 AND COALESCE(volumen_m3, 0) >= 0 AND COALESCE(piezas, 0) >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'embarque_contenedores_medidas_no_negativas') THEN
    ALTER TABLE public.embarque_contenedores
      ADD CONSTRAINT embarque_contenedores_medidas_no_negativas
      CHECK (COALESCE(peso_kg, 0) >= 0 AND COALESCE(volumen_m3, 0) >= 0 AND COALESCE(piezas, 0) >= 0);
  END IF;
END $$;

-- ── Ajuste final M-14 (misma moneda ⇒ factor 1 legítimo) ───────────────
-- M-14 (ajuste): un pago en la misma moneda que la factura usa factor 1, que
-- es legítimo. La banda 5–40 sólo aplica cuando hay conversión real de moneda.
CREATE OR REPLACE FUNCTION public._assert_tc_banda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_row jsonb := to_jsonb(NEW);
  v_tc numeric;
  v_moneda text := v_row->>'moneda';
  v_moneda_doc text;
BEGIN
  v_tc := COALESCE(
    NULLIF(v_row->>'tipo_cambio_usd', '')::numeric,
    NULLIF(v_row->>'tipo_cambio', '')::numeric
  );
  IF v_tc IS NULL OR v_moneda IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'pagos_proveedor' THEN
    SELECT pf.moneda::text INTO v_moneda_doc
    FROM public.proveedor_facturas pf
    WHERE pf.id = (v_row->>'proveedor_factura_id')::uuid;
  ELSE
    SELECT f.moneda::text INTO v_moneda_doc
    FROM public.facturas f
    WHERE f.id = (v_row->>'factura_id')::uuid;
  END IF;

  -- Sin conversión de moneda (pago y documento en la misma divisa) el factor
  -- neutro 1 es correcto y no se evalúa la banda.
  IF v_moneda_doc IS NOT NULL AND v_moneda_doc = v_moneda THEN
    RETURN NEW;
  END IF;

  IF (v_moneda <> 'MXN' OR COALESCE(v_moneda_doc, 'MXN') <> 'MXN')
     AND (v_tc < 5 OR v_tc > 40) THEN
    RAISE EXCEPTION
      'LC_TC_FUERA_DE_BANDA: el tipo de cambio (%) está fuera de la banda razonable (5 a 40 MXN por divisa).',
      v_tc
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_tc_banda() FROM PUBLIC, anon, authenticated;