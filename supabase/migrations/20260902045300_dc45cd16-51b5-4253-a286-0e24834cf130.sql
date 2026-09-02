-- =====================================================================
-- Ola pulido YAGNI: CxP (programación/registro/ejecución de pagos),
-- cotización → embarque (naviera_id/agente_id, unicidad) y aceptación.
-- Forward-only e idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Programación de pago: RPC mínima para Tesorería (el UPDATE directo
--    de proveedor_facturas está bloqueado por RLS para `tesorero`).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.programar_pago_proveedor(
  p_factura_id uuid,
  p_fecha date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_factura  public.proveedor_facturas;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO: inicia sesión para programar el pago' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_factura
    FROM public.proveedor_facturas
   WHERE id = p_factura_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_factura.id IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: la factura de proveedor no existe o fue eliminada' USING ERRCODE = 'P0001';
  END IF;

  -- Roles EXACTOS y dentro de la organización de la factura (sin jerarquías).
  IF NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = v_factura.organization_id
         AND om.user_id = v_uid
         AND om.role::text = ANY (ARRAY['admin','admin_org','tesorero','contador'])
    )
  ) THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: tu rol no puede programar pagos en esta organización' USING ERRCODE = '42501';
  END IF;

  IF v_factura.estado = 'Cancelada'::estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_CXP_CANCELADA: no se puede programar el pago de una factura cancelada' USING ERRCODE = 'P0001';
  END IF;

  IF p_fecha IS NOT NULL AND v_factura.fecha_emision IS NOT NULL AND p_fecha < v_factura.fecha_emision THEN
    RAISE EXCEPTION 'LC_CXP_FECHA_PROGRAMADA_INVALIDA: la fecha programada (%) no puede ser anterior a la emisión (%)',
      p_fecha, v_factura.fecha_emision USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.proveedor_facturas
     SET fecha_programada_pago = p_fecha, updated_at = now()
   WHERE id = p_factura_id;

  RETURN p_factura_id;
END;
$$;

REVOKE ALL ON FUNCTION public.programar_pago_proveedor(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.programar_pago_proveedor(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.programar_pago_proveedor(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.programar_pago_proveedor(uuid, date) TO service_role;

-- ---------------------------------------------------------------------
-- 2) Movimiento bancario espejo de un pago: asegurar (idempotente).
--    SECURITY INVOKER: conserva exactamente los permisos actuales del
--    cliente (que insertaba el movimiento directamente bajo RLS).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._asegurar_movimiento_pago_proveedor(p_pago_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_pago       public.pagos_proveedor;
  v_cuenta_mon text;
  v_cargo      numeric;
  v_concepto   text;
  v_mov_id     uuid;
BEGIN
  SELECT id INTO v_mov_id
    FROM public.bbva_movimientos
   WHERE pago_proveedor_id = p_pago_id AND deleted_at IS NULL
   LIMIT 1;
  IF v_mov_id IS NOT NULL THEN
    RETURN v_mov_id;
  END IF;

  SELECT * INTO v_pago
    FROM public.pagos_proveedor
   WHERE id = p_pago_id AND deleted_at IS NULL;
  IF v_pago.id IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de proveedor no existe o está eliminado' USING ERRCODE = 'P0001';
  END IF;
  IF v_pago.cuenta_bancaria_id IS NULL THEN
    RETURN NULL; -- pago sin cuenta bancaria: no hay salida de efectivo que registrar
  END IF;

  SELECT moneda::text INTO v_cuenta_mon
    FROM public.cuentas_bancarias
   WHERE id = v_pago.cuenta_bancaria_id AND deleted_at IS NULL;
  IF v_cuenta_mon IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_SIN_CUENTA: la cuenta bancaria del pago no existe o está dada de baja' USING ERRCODE = 'P0001';
  END IF;

  -- El movimiento SIEMPRE se registra en la moneda de la cuenta; nunca 1:1
  -- silencioso cross-moneda (clase BL-04).
  v_cargo := v_pago.monto;
  IF v_cuenta_mon IS DISTINCT FROM v_pago.moneda::text THEN
    IF COALESCE(v_pago.tipo_cambio_usd, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: el pago es en % y la cuenta en %, pero el pago no tiene tipo de cambio registrado',
        v_pago.moneda, v_cuenta_mon USING ERRCODE = 'P0001';
    END IF;
    IF v_pago.moneda::text = 'USD' AND v_cuenta_mon = 'MXN' THEN
      v_cargo := v_pago.monto * v_pago.tipo_cambio_usd;
    ELSIF v_pago.moneda::text = 'MXN' AND v_cuenta_mon = 'USD' THEN
      v_cargo := v_pago.monto / v_pago.tipo_cambio_usd;
    END IF;
  END IF;

  SELECT 'Pago prov. '
         || COALESCE(NULLIF(pf.folio_proveedor, ''), NULLIF(pf.folio_interno, ''), 's/folio')
         || ' — ' || COALESCE(pr.nombre, pf.proveedor_nombre, 'proveedor')
    INTO v_concepto
  FROM public.proveedor_facturas pf
  LEFT JOIN public.proveedores pr ON pr.id = pf.proveedor_id
  WHERE pf.id = v_pago.proveedor_factura_id;

  INSERT INTO public.bbva_movimientos (
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, pago_proveedor_id,
    conciliado_por, conciliado_at, importado_por
  ) VALUES (
    v_pago.organization_id, v_pago.cuenta_bancaria_id, v_pago.fecha_pago,
    COALESCE(v_concepto, 'Pago a proveedor'), COALESCE(v_pago.referencia, ''),
    ROUND(v_cargo, 2), 0, 'pago-' || p_pago_id::text, 'Conciliado', p_pago_id,
    auth.uid(), now(), auth.uid()
  )
  ON CONFLICT (hash_dedupe) DO NOTHING
  RETURNING id INTO v_mov_id;

  IF v_mov_id IS NULL THEN
    SELECT id INTO v_mov_id FROM public.bbva_movimientos
     WHERE hash_dedupe = 'pago-' || p_pago_id::text LIMIT 1;
  END IF;

  RETURN v_mov_id;
END;
$$;

REVOKE ALL ON FUNCTION public._asegurar_movimiento_pago_proveedor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._asegurar_movimiento_pago_proveedor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._asegurar_movimiento_pago_proveedor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._asegurar_movimiento_pago_proveedor(uuid) TO service_role;

-- ---------------------------------------------------------------------
--    Registro de pago + movimiento en UNA transacción, idempotente por
--    client_request_id. SECURITY INVOKER: mismos permisos/RLS/guards de
--    triggers que el INSERT que hacía el cliente.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_pago_proveedor_atomico(
  p_factura_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_moneda text,
  p_metodo_pago text,
  p_referencia text DEFAULT ''::text,
  p_cuenta_bancaria_id uuid DEFAULT NULL,
  p_notas text DEFAULT ''::text,
  p_tipo_cambio_usd numeric DEFAULT NULL,
  p_diferencia_cambiaria_mxn numeric DEFAULT NULL,
  p_client_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org      uuid;
  v_pago_id  uuid;
  v_mov_id   uuid;
  v_reintento boolean := false;
BEGIN
  IF p_client_request_id IS NOT NULL THEN
    SELECT id INTO v_pago_id
      FROM public.pagos_proveedor
     WHERE client_request_id = p_client_request_id
       AND deleted_at IS NULL;
    IF v_pago_id IS NOT NULL THEN
      -- Reintento del mismo submit: devolvemos el pago ya creado y
      -- aseguramos (reparamos) su movimiento bancario. Nunca 23505.
      v_mov_id := public._asegurar_movimiento_pago_proveedor(v_pago_id);
      RETURN jsonb_build_object('pago_id', v_pago_id, 'movimiento_id', v_mov_id, 'reintento', true);
    END IF;
  END IF;

  SELECT organization_id INTO v_org
    FROM public.proveedor_facturas
   WHERE id = p_factura_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: la factura de proveedor no existe o fue eliminada' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.pagos_proveedor (
      organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
      tipo_cambio_usd, metodo_pago, referencia, cuenta_bancaria_id, notas,
      diferencia_cambiaria_mxn, client_request_id, created_by
    ) VALUES (
      v_org, p_factura_id, p_fecha_pago, p_monto, p_moneda::moneda,
      NULLIF(COALESCE(p_tipo_cambio_usd, 0), 0), p_metodo_pago, COALESCE(p_referencia, ''),
      p_cuenta_bancaria_id, COALESCE(p_notas, ''), p_diferencia_cambiaria_mxn,
      p_client_request_id, auth.uid()
    )
    RETURNING id INTO v_pago_id;
  EXCEPTION WHEN unique_violation THEN
    -- Carrera con otro submit de la misma llave: el pago SÍ quedó creado.
    SELECT id INTO v_pago_id
      FROM public.pagos_proveedor
     WHERE client_request_id = p_client_request_id AND deleted_at IS NULL;
    IF v_pago_id IS NULL THEN RAISE; END IF;
    v_reintento := true;
  END;

  v_mov_id := public._asegurar_movimiento_pago_proveedor(v_pago_id);

  RETURN jsonb_build_object('pago_id', v_pago_id, 'movimiento_id', v_mov_id, 'reintento', v_reintento);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_atomico(uuid, date, numeric, text, text, text, uuid, text, numeric, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_atomico(uuid, date, numeric, text, text, text, uuid, text, numeric, numeric, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_atomico(uuid, date, numeric, text, text, text, uuid, text, numeric, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_atomico(uuid, date, numeric, text, text, text, uuid, text, numeric, numeric, uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 3) ejecutar_pago_programado: rol EXACTO dentro de la organización de la
--    factura, programación existente y fecha en rango [emisión, hoy].
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ejecutar_pago_programado(p_factura_id uuid, p_cuenta_bancaria_id uuid, p_fecha date, p_monto numeric, p_metodo_pago text DEFAULT 'Transferencia'::text, p_referencia text DEFAULT ''::text, p_request_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_factura public.proveedor_facturas;
  v_cuenta public.cuentas_bancarias;
  v_saldo_cuenta numeric;
  v_pago public.pagos_proveedor;
  v_mov_id uuid;
  v_resp jsonb;
  v_cached jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_cached := public.idempotency_claim(p_request_id, 'ejecutar_pago_programado');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_PAGO_PROGRAMADO_EN_PROCESO: Este pago programado ya está en proceso; espera unos segundos y verifica antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    RETURN v_cached;
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_PAGO_MONTO_INVALIDO: El monto del pago no es válido.';
  END IF;

  SELECT * INTO v_factura
    FROM public.proveedor_facturas
    WHERE id = p_factura_id AND deleted_at IS NULL
    FOR UPDATE;
  IF v_factura.id IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: La factura de proveedor no existe o fue eliminada.';
  END IF;

  v_org := v_factura.organization_id;

  -- Rol EXACTO dentro de la organización de la factura (antes bastaba tener
  -- el rol en CUALQUIER organización).
  IF NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = v_org
         AND om.user_id = v_uid
         AND om.role::text = ANY (ARRAY['admin','admin_org','tesorero'])
    )
  ) THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: Tu rol no puede ejecutar pagos programados en esta organización.'
      USING ERRCODE = '42501';
  END IF;

  IF v_factura.fecha_programada_pago IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PROGRAMACION: la factura no tiene fecha programada de pago; prográmala antes de ejecutarla.'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_fecha IS NULL
     OR (v_factura.fecha_emision IS NOT NULL AND p_fecha < v_factura.fecha_emision)
     OR p_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_INVALIDA: la fecha del pago (%) debe estar entre la emisión (%) y hoy (%).',
      p_fecha, v_factura.fecha_emision, CURRENT_DATE USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_cuenta
    FROM public.cuentas_bancarias
    WHERE id = p_cuenta_bancaria_id AND deleted_at IS NULL
    FOR UPDATE;
  IF v_cuenta.id IS NULL THEN
    RAISE EXCEPTION 'LC_CUENTA_NO_EXISTE: La cuenta bancaria no existe o fue eliminada.';
  END IF;

  IF v_cuenta.organization_id <> v_org THEN
    RAISE EXCEPTION 'LC_CUENTA_ORG_MISMATCH: La cuenta bancaria pertenece a otra organización.';
  END IF;

  IF v_cuenta.moneda <> v_factura.moneda THEN
    RAISE EXCEPTION 'LC_PAGO_MONEDA_CUENTA_MISMATCH: La moneda de la cuenta (%) no coincide con la de la factura (%).',
      v_cuenta.moneda, v_factura.moneda;
  END IF;

  v_saldo_cuenta := public.saldo_cuenta_bancaria(v_cuenta.id);

  IF p_monto > v_saldo_cuenta + 0.005 THEN
    RAISE EXCEPTION 'LC_CUENTA_SALDO_INSUFICIENTE: El saldo de la cuenta (%) es insuficiente para pagar %.',
      round(v_saldo_cuenta, 2), round(p_monto, 2);
  END IF;

  INSERT INTO public.pagos_proveedor (
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
    metodo_pago, referencia, cuenta_bancaria_id, notas, created_by
  ) VALUES (
    v_org, p_factura_id, p_fecha, p_monto, v_factura.moneda,
    p_metodo_pago, COALESCE(p_referencia, ''), v_cuenta.id,
    'Ejecución de pago programado', v_uid
  )
  RETURNING * INTO v_pago;

  INSERT INTO public.bbva_movimientos (
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, saldo, hash_dedupe, estado_conciliacion,
    pago_proveedor_id, conciliado_por, conciliado_at, importado_por
  ) VALUES (
    v_org, v_cuenta.id, p_fecha,
    'Pago programado: ' || COALESCE(v_factura.proveedor_nombre, ''),
    COALESCE(p_referencia, ''),
    p_monto, 0, v_saldo_cuenta - p_monto,
    'pago-programado-' || v_pago.id::text,
    'Conciliado', v_pago.id, v_uid, now(), v_uid
  )
  RETURNING id INTO v_mov_id;

  v_resp := jsonb_build_object(
    'pago_id', v_pago.id,
    'movimiento_id', v_mov_id,
    'saldo_cuenta_restante', v_saldo_cuenta - p_monto
  );

  PERFORM public.idempotency_store(p_request_id, v_resp);

  RETURN v_resp;
END;
$$;

-- ---------------------------------------------------------------------
-- 4/5) Una cotización → un solo embarque vivo.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS embarques_cotizacion_unica_viva
  ON public.embarques (cotizacion_id)
  WHERE cotizacion_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public._assert_cotizacion_convertible(p_cotizacion_id uuid, p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado    public.estado_cotizacion;
  v_org       uuid;
  v_deleted   timestamptz;
  v_folio     text;
  v_existente uuid;
BEGIN
  IF p_cotizacion_id IS NULL THEN RETURN; END IF;

  SELECT estado, organization_id, deleted_at, folio
    INTO v_estado, v_org, v_deleted, v_folio
    FROM public.cotizaciones
   WHERE id = p_cotizacion_id
   FOR UPDATE;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA: la cotización no existe' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_ELIMINADA: la cotización está eliminada' USING ERRCODE = 'P0001';
  END IF;
  IF p_org IS NOT NULL AND v_org IS DISTINCT FROM p_org THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: la cotización pertenece a otra organización' USING ERRCODE = '42501';
  END IF;
  IF v_estado NOT IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO: la cotización debe estar Aceptada o En operación (actual: %)', v_estado
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existente
    FROM public.embarques
   WHERE cotizacion_id = p_cotizacion_id AND deleted_at IS NULL
   LIMIT 1;
  IF v_existente IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_YA_TIENE_EMBARQUE: la cotización % ya generó un embarque', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_cotizacion_convertible(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_cotizacion_convertible(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._assert_cotizacion_convertible(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._assert_cotizacion_convertible(uuid, uuid) TO service_role;

-- crear_embarque_completo: persiste naviera_id/agente_id + guard de cotización.
CREATE OR REPLACE FUNCTION public.crear_embarque_completo(p_embarque jsonb, p_conceptos_venta jsonb DEFAULT '[]'::jsonb, p_conceptos_costo jsonb DEFAULT '[]'::jsonb, p_documentos jsonb DEFAULT '[]'::jsonb, p_request_id uuid DEFAULT NULL::uuid, p_contenedores jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nuevo_id uuid := gen_random_uuid();
  v_org_id uuid; v_resp jsonb;
  v_cot_id uuid;
  cv jsonb; cc jsonb; doc jsonb; ct jsonb;
BEGIN
  PERFORM public._assert_medidas_embarque(p_embarque);
  v_org_id := current_user_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'No organization context for caller'; END IF;
  PERFORM public._assert_writer(v_org_id);
  v_cot_id := NULLIF(p_embarque->>'cotizacion_id','')::uuid;
  PERFORM public._assert_relaciones_embarque(
    v_org_id,
    NULLIF(p_embarque->>'cliente_id','')::uuid,
    v_cot_id,
    p_conceptos_costo
  );
  -- Una cotización sólo puede producir un embarque vivo (bloqueo FOR UPDATE).
  PERFORM public._assert_cotizacion_convertible(v_cot_id, v_org_id);
  v_resp := public.idempotency_claim(p_request_id, 'crear_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;
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
    NULLIF(NULLIF(p_embarque->>'tipo_cambio_usd','')::numeric, 0),
    NULLIF(NULLIF(p_embarque->>'tipo_cambio_eur','')::numeric, 0),
    COALESCE(p_embarque->>'tipo_carga','Carga General'),
    p_embarque->>'msds_archivo', COALESCE(p_embarque->>'operador',''),
    v_org_id,
    v_cot_id
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
$$;

REVOKE ALL ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6) aceptar_cotizacion_version: rol autorizado EN la organización + SoD.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version INT; v_org UUID; v_folio TEXT;
  v_estado_actual TEXT; v_vigencia DATE;
  v_cliente_id UUID; v_requiere BOOLEAN; v_origen TEXT;
  v_creado_por UUID;
  v_uid UUID := auth.uid();
  v_admin BOOLEAN;
BEGIN
  SELECT version, organization_id, folio, estado::text, fecha_vigencia, cliente_id, created_by
    INTO v_version, v_org, v_folio, v_estado_actual, v_vigencia, v_cliente_id, v_creado_por
    FROM cotizaciones WHERE id = p_cotizacion_id AND deleted_at IS NULL;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;

  v_admin := public.has_role(v_uid, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = v_org AND om.user_id = v_uid
         AND om.role::text = ANY (ARRAY['admin','admin_org'])
    );

  -- Rol autorizado dentro de la organización (antes bastaba ser miembro).
  IF NOT (
    v_admin
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = v_org AND om.user_id = v_uid
         AND om.role::text = ANY (ARRAY['gerente_comercial','vendedor','operador','gerente_operaciones'])
    )
  ) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: tu rol no puede aceptar cotizaciones en esta organización' USING ERRCODE='42501';
  END IF;

  -- Segregación de funciones: quien la creó no la acepta (salvo admin).
  IF v_creado_por IS NOT NULL AND v_uid IS NOT NULL AND v_creado_por = v_uid AND NOT v_admin THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: quien creó la cotización no puede aceptarla' USING ERRCODE='42501';
  END IF;

  IF v_vigencia IS NOT NULL AND v_vigencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COT_VENCIDA: la cotización venció el %, extienda la vigencia antes de aceptar', v_vigencia USING ERRCODE='P0001';
  END IF;

  v_requiere := public.cliente_requiere_autorizacion(v_cliente_id, 'cotizacion');
  v_origen := CASE WHEN v_requiere THEN 'autorizacion_cliente' ELSE 'interna_cliente_de_casa' END;

  IF v_requiere THEN
    IF v_estado_actual NOT IN ('Borrador','Enviada') THEN
      RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar en Borrador/Enviada (actual: %, estados_permitidos: [Borrador, Enviada])', v_estado_actual
        USING ERRCODE='P0001', HINT='estados_permitidos=Borrador,Enviada';
    END IF;
  ELSE
    IF v_estado_actual NOT IN ('Borrador','Solicitada','Enviada') THEN
      RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar en Borrador/Solicitada/Enviada (actual: %, estados_permitidos: [Borrador, Solicitada, Enviada])', v_estado_actual
        USING ERRCODE='P0001', HINT='estados_permitidos=Borrador,Solicitada,Enviada';
    END IF;
  END IF;

  UPDATE cotizaciones
     SET version_aceptada=v_version, aceptada_en=now(), aceptada_por=auth.uid(),
         estado='Aceptada', updated_at=now()
   WHERE id = p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_org, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
    'cotizacion.aceptada_version_fijada','cotizaciones',
    p_cotizacion_id, COALESCE(v_folio,''),
    jsonb_build_object('version_aceptada',v_version,'estado_previo',v_estado_actual,'origen_aceptacion',v_origen));
  RETURN jsonb_build_object('cotizacion_id',p_cotizacion_id,'version_aceptada',v_version,'origen_aceptacion',v_origen);
END;
$$;
