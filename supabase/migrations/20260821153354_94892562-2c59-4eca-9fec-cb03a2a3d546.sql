-- =============================================================================
-- Ola 8 · Pilotos de autorización por organización (has_any_role_in_org)
-- =============================================================================
-- Migra 3 RPCs financieras del chequeo de rol GLOBAL (user_roles, sin org) al
-- chequeo por membresía en la organización del documento. Cuerpos tomados 1:1
-- de la definición vigente en base; sólo cambia el bloque de autorización.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.registrar_pago_proveedor_lote(p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_proveedor_id uuid := (p_payload->>'proveedor_id')::uuid;
  v_fecha date := COALESCE((p_payload->>'fecha_pago')::date, CURRENT_DATE);
  v_moneda public.moneda := (p_payload->>'moneda')::public.moneda;
  v_tc numeric := NULLIF(p_payload->>'tipo_cambio_usd','')::numeric;
  -- Ola 11 · RNF-05: importe real de la transferencia (nuevo en el payload).
  v_importe numeric := NULLIF(p_payload->>'importe_recibido','')::numeric;
  v_metodo text := COALESCE(NULLIF(TRIM(p_payload->>'metodo_pago'), ''), 'Transferencia');
  v_referencia text := COALESCE(NULLIF(TRIM(p_payload->>'referencia'), ''), '');
  v_cuenta_id uuid := NULLIF(p_payload->>'cuenta_bancaria_id','')::uuid;
  v_notas text := COALESCE(p_payload->>'notas','');
  -- BL-02 · idempotencia (espejo RNF-01 de registrar_pago_cliente_lote):
  -- llave opcional del cliente para deduplicar dobles submits/reintentos.
  v_request_id uuid := NULLIF(p_payload->>'request_id','')::uuid;
  v_cached jsonb;
  v_cuenta public.cuentas_bancarias;
  v_proveedor_nombre text;
  v_total numeric := 0;
  v_lote_id uuid;
  v_renglon jsonb;
  v_fecha_emision date;
  -- Ola 12 · R3BD-03: moneda de la factura para el guard de paridad.
  v_moneda_factura public.moneda;
  -- BL-03: estado de la factura para el guard de vida.
  v_estado_factura public.estado_proveedor_factura;
  v_n int := 0;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  -- BL-02: reclamo atómico de la llave. Reintento del mismo submit →
  -- respuesta almacenada; ejecución aún en vuelo → rechazo claro.
  v_cached := public.idempotency_claim(v_request_id, 'registrar_pago_proveedor_lote');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_LOTE_EN_PROCESO: Este pago en lote ya está en proceso; espera unos segundos y verifica el historial antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    RETURN (v_cached->>'lote_id')::uuid;
  END IF;

  SELECT organization_id, nombre INTO v_org, v_proveedor_nombre
  FROM public.proveedores WHERE id = v_proveedor_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_LOTE_PROVEEDOR_NO_EXISTE: El proveedor no existe.';
  END IF;

  IF v_org <> public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_LOTE_PROVEEDOR_OTRA_ORG: El proveedor pertenece a otra organización.';
  END IF;

  -- Ola 8: el rol financiero debe venir de la membresía en ESTA organización
  -- (antes: EXISTS global sobre user_roles — un contador de la org A podía
  -- registrar pagos en la org B). super_admin conserva su bypass de plataforma
  -- dentro del helper.
  IF NOT public.has_any_role_in_org(v_uid,
       ARRAY['admin','admin_org','contador','tesorero']::public.app_role[],
       v_org) THEN
    RAISE EXCEPTION 'LC_LOTE_SIN_ROL: Sólo administración, contabilidad o tesorería pueden registrar pagos en lote.'
      USING ERRCODE = '42501';
  END IF;

  -- Ola 11 · RFE-02/RNF-03: misma regla que el pago individual.
  IF v_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_LOTE_FECHA_FUTURA: La fecha del pago no puede ser futura.'
      USING ERRCODE = '42501';
  END IF;

  -- Ola 12 · R3BD-02 (espejo del guard CxC LC_COBRO_LOTE_TC_REQUERIDO de
  -- RFE-03, 20260821030800:97-100): un lote en USD/EUR sin tipo de cambio NO
  -- se registra. Antes el payload con tipo_cambio_usd NULL pasaba y la
  -- reportería MXN hacía COALESCE(pp.tipo_cambio_usd, 1) → 1:1 silencioso.
  IF v_moneda <> 'MXN'::public.moneda AND (v_tc IS NULL OR v_tc <= 0) THEN
    RAISE EXCEPTION 'LC_LOTE_TC_REQUERIDO: No hay tipo de cambio disponible para un pago en lote en %; reintenta cuando el servicio de tipos de cambio responda.', v_moneda
      USING ERRCODE = '42501';
  END IF;

  IF v_cuenta_id IS NULL AND v_metodo <> 'Efectivo' THEN
    RAISE EXCEPTION 'LC_LOTE_CUENTA_REQUERIDA: Selecciona la cuenta bancaria de donde sale el pago (sólo Efectivo puede omitirla).';
  END IF;

  IF v_cuenta_id IS NOT NULL THEN
    SELECT * INTO v_cuenta FROM public.cuentas_bancarias
    WHERE id = v_cuenta_id AND deleted_at IS NULL;

    IF v_cuenta.id IS NULL THEN
      RAISE EXCEPTION 'LC_LOTE_CUENTA_INVALIDA: La cuenta bancaria no existe o está dada de baja.';
    END IF;
    IF v_cuenta.organization_id <> v_org THEN
      RAISE EXCEPTION 'LC_LOTE_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.';
    END IF;
    IF v_cuenta.moneda <> v_moneda THEN
      RAISE EXCEPTION 'LC_LOTE_CUENTA_DIVISA: La cuenta está en % y el pago en %.', v_cuenta.moneda, v_moneda;
    END IF;
  END IF;

  -- Ola 11 · RNF-06 (espejo RG4-6): una misma factura no puede aparecer dos veces.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) AS r
    GROUP BY (r->>'factura_id')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'LC_LOTE_FACTURA_DUPLICADA: Hay facturas repetidas en el lote; cada factura sólo puede aparecer una vez.'
      USING ERRCODE = '42501';
  END IF;

  -- Validar renglones y calcular total.
  -- Ola 1 (espejo BL-13 de CxC): los locks se toman en orden determinista por
  -- factura_id, no en el orden del payload; dos lotes concurrentes con las
  -- mismas facturas en orden distinto hacían deadlock.
  FOR v_renglon IN
    SELECT r FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) AS r
    ORDER BY (r->>'factura_id')::uuid
  LOOP
    IF COALESCE((v_renglon->>'monto')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_LOTE_MONTO_INVALIDO: Cada factura del lote debe tener un importe mayor a cero.';
    END IF;

    -- Ola 11 · RFE-02/RNF-03: el SELECT sirve doble — valida que la factura
    -- exista/sea del proveedor y trae fecha_emision para el guard de fecha.
    -- Ola 12 · R3BD-03: también trae la moneda para el guard de paridad.
    -- BL-03: también trae el estado para el guard de vida (paridad CxC).
    -- Ola 1: FOR UPDATE serializa el reparto contra pagos concurrentes.
    SELECT pf.fecha_emision, pf.moneda, pf.estado
      INTO v_fecha_emision, v_moneda_factura, v_estado_factura
    FROM public.proveedor_facturas pf
    WHERE pf.id = (v_renglon->>'factura_id')::uuid
      AND pf.deleted_at IS NULL
      AND pf.organization_id = v_org
      AND pf.proveedor_id = v_proveedor_id
    FOR UPDATE OF pf;

    IF v_fecha_emision IS NULL THEN
      RAISE EXCEPTION 'LC_LOTE_FACTURA_INVALIDA: Una de las facturas no existe o no pertenece al proveedor seleccionado.';
    END IF;

    -- BL-03: una factura Cancelada no admite pagos (el guard de aprobación
    -- no basta: cancelar_factura_proveedor conservaba estado_aprobacion).
    IF v_estado_factura = 'Cancelada'::public.estado_proveedor_factura THEN
      RAISE EXCEPTION 'LC_LOTE_FACTURA_NO_VIVA: Una de las facturas del lote está Cancelada y no admite pagos; retírala del reparto.'
        USING ERRCODE = '42501';
    END IF;

    -- Ola 12 · R3BD-03 (paridad CxC): la factura debe ser de la moneda del
    -- lote. Excepción: cruce de monedas permitido sólo con TC válido, porque
    -- el trigger convertir_monto_pago_a_factura convierte con ese TC.
    IF v_moneda_factura <> v_moneda AND (v_tc IS NULL OR v_tc <= 0) THEN
      RAISE EXCEPTION 'LC_LOTE_FACTURA_MONEDA: La factura está en % y el lote en %; captura el tipo de cambio o retira la factura del lote.', v_moneda_factura, v_moneda
        USING ERRCODE = '42501';
    END IF;

    IF v_fecha < v_fecha_emision THEN
      RAISE EXCEPTION 'LC_LOTE_FECHA_PREVIA_EMISION: La fecha del pago es anterior a la emisión de una de las facturas del lote.'
        USING ERRCODE = '42501';
    END IF;

    v_total := v_total + ROUND((v_renglon->>'monto')::numeric, 2);
    v_n := v_n + 1;
  END LOOP;

  IF v_n < 2 THEN
    RAISE EXCEPTION 'LC_LOTE_MINIMO_FACTURAS: Un pago en lote requiere al menos dos facturas.';
  END IF;

  -- Ola 11 · RNF-05 (espejo RG4-5): el reparto debe cuadrar EXACTAMENTE con
  -- la transferencia. Canon RNF-02: comparación exacta tras ROUND a 2
  -- decimales (sin tolerancia), igual que promete el mensaje.
  IF v_importe IS NULL OR v_importe <= 0 THEN
    RAISE EXCEPTION 'LC_LOTE_IMPORTE_REQUERIDO: Captura el importe total de la transferencia.'
      USING ERRCODE = '42501';
  END IF;
  IF ROUND(v_importe, 2) IS DISTINCT FROM ROUND(v_total, 2) THEN
    RAISE EXCEPTION 'LC_LOTE_IMPORTE_NO_CUADRA: El reparto (%) no cuadra con el importe de la transferencia (%); no se permite sobrante sin asignar.', v_total, v_importe
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.pagos_proveedor_lote
    (organization_id, proveedor_id, fecha_pago, moneda, monto_total, tipo_cambio_usd,
     metodo_pago, referencia, cuenta_bancaria_id, notas, created_by)
  VALUES
    (v_org, v_proveedor_id, v_fecha, v_moneda, v_total, v_tc,
     v_metodo, v_referencia, v_cuenta_id, v_notas, v_uid)
  RETURNING id INTO v_lote_id;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    INSERT INTO public.pagos_proveedor
      (organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd,
       metodo_pago, referencia, cuenta_bancaria_id, notas, created_by, lote_id)
    VALUES
      (v_org, (v_renglon->>'factura_id')::uuid, v_fecha,
       ROUND((v_renglon->>'monto')::numeric, 2), v_moneda, v_tc,
       v_metodo, v_referencia, v_cuenta_id, v_notas, v_uid, v_lote_id);
  END LOOP;

  IF v_cuenta_id IS NOT NULL THEN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
       cargo, abono, hash_dedupe, estado_conciliacion,
       pago_proveedor_lote_id, conciliado_por, conciliado_at, importado_por)
    VALUES
      (v_org, v_cuenta_id, v_fecha,
       'Pago en lote (' || v_n || ' facturas) — ' || COALESCE(v_proveedor_nombre, 'proveedor'),
       v_referencia, v_total, 0, 'lote-' || v_lote_id::text, 'Conciliado',
       v_lote_id, v_uid, now(), v_uid);
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_org, v_uid, COALESCE(v_email,''), 'registrar_pago_proveedor_lote', 'cxp',
            v_lote_id, 'Pago en lote ' || v_lote_id::text,
            jsonb_build_object('proveedor_id', v_proveedor_id, 'monto_total', v_total,
                               'importe_recibido', v_importe,
                               'moneda', v_moneda, 'facturas', v_n,
                               'cuenta_bancaria_id', v_cuenta_id, 'referencia', v_referencia));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_pago_proveedor_lote: % %', SQLSTATE, SQLERRM;
  END;

  -- BL-02: almacena la respuesta para los reintentos con la misma llave
  -- (no-op cuando request_id viene NULL).
  PERFORM public.idempotency_store(v_request_id,
    jsonb_build_object('lote_id', v_lote_id, 'monto_total', v_total, 'facturas', v_n));

  RETURN v_lote_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.registrar_pago_cliente_lote(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_cliente_id uuid := (p_payload->>'cliente_id')::uuid;
  v_fecha date := COALESCE((p_payload->>'fecha_pago')::date, CURRENT_DATE);
  v_moneda public.moneda := (p_payload->>'moneda')::public.moneda;
  v_tc numeric := NULLIF(p_payload->>'tipo_cambio_usd','')::numeric;
  -- Ola 5 · RG4-5: importe real recibido del cliente (nuevo en el payload).
  v_importe numeric := NULLIF(p_payload->>'importe_recibido','')::numeric;
  v_forma text := COALESCE(NULLIF(TRIM(p_payload->>'forma_pago'), ''), '03');
  v_referencia text := COALESCE(NULLIF(TRIM(p_payload->>'referencia'), ''), '');
  v_cuenta_id uuid := NULLIF(p_payload->>'cuenta_bancaria_id','')::uuid;
  v_notas text := COALESCE(p_payload->>'notas','');
  -- Ola 11 · RNF-01: llave de idempotencia del cliente (opcional).
  v_request_id uuid := NULLIF(p_payload->>'request_id','')::uuid;
  v_cached jsonb;
  v_resp jsonb;
  v_cuenta public.cuentas_bancarias;
  v_cliente_nombre text;
  v_total numeric := 0;
  v_lote_id uuid;
  v_renglon jsonb;
  v_factura_id uuid;
  v_monto numeric;
  v_saldo numeric;
  v_fecha_emision date;
  v_pago_id uuid;
  v_n int := 0;
  v_pagos jsonb := '[]'::jsonb;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  -- Ola 11 · RNF-01: reclamo atómico de la llave. Reintento del mismo
  -- submit → respuesta almacenada; ejecución aún en vuelo → rechazo claro.
  v_cached := public.idempotency_claim(v_request_id, 'registrar_pago_cliente_lote');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_EN_PROCESO: Este cobro en lote ya está en proceso; espera unos segundos y verifica el historial antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    RETURN v_cached;
  END IF;

  SELECT organization_id, nombre INTO v_org, v_cliente_nombre
  FROM public.clientes WHERE id = v_cliente_id AND deleted_at IS NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_CLIENTE_NO_EXISTE: El cliente no existe.';
  END IF;

  IF v_org <> public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_CLIENTE_OTRA_ORG: El cliente pertenece a otra organización.';
  END IF;

  -- Ola 8: rol financiero por membresía en la organización del cliente.
  IF NOT public.has_any_role_in_org(v_uid,
       ARRAY['admin','admin_org','contador','tesorero']::public.app_role[],
       v_org) THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_SIN_ROL: Sólo administración, contabilidad o tesorería pueden registrar cobros en lote.'
      USING ERRCODE = '42501';
  END IF;

  -- Ola 11 · RFE-02/RNF-03: misma regla que el cobro individual (FE-03).
  IF v_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_FECHA_FUTURA: La fecha del cobro no puede ser futura.'
      USING ERRCODE = '42501';
  END IF;

  -- Ola 11 · RFE-03 (patrón FE-01): lote extranjero sin TC no se registra.
  IF v_moneda <> 'MXN'::public.moneda AND (v_tc IS NULL OR v_tc <= 0) THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_TC_REQUERIDO: No hay tipo de cambio disponible para un cobro en %; reintenta cuando el servicio de tipos de cambio responda.', v_moneda
      USING ERRCODE = '42501';
  END IF;

  IF v_cuenta_id IS NOT NULL THEN
    SELECT * INTO v_cuenta FROM public.cuentas_bancarias
    WHERE id = v_cuenta_id AND deleted_at IS NULL;

    IF v_cuenta.id IS NULL THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_CUENTA_INVALIDA: La cuenta bancaria no existe o está dada de baja.';
    END IF;
    IF v_cuenta.organization_id <> v_org THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.';
    END IF;
    IF v_cuenta.moneda <> v_moneda THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_CUENTA_DIVISA: La cuenta está en % y el cobro en %.', v_cuenta.moneda, v_moneda;
    END IF;
  END IF;

  -- Ola 5 · RG4-6: una misma factura no puede aparecer dos veces.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) AS r
    GROUP BY (r->>'factura_id')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_FACTURA_DUPLICADA: Hay facturas repetidas en el lote; cada factura sólo puede aparecer una vez.'
      USING ERRCODE = '42501';
  END IF;

  -- Validación de renglones: tenancy, cliente, moneda y saldo real por factura.
  -- BL-13 (migración 20260817143000): los locks FOR UPDATE se toman en orden
  -- determinista (factura_id), no en el orden del payload; dos lotes
  -- concurrentes con las mismas facturas en orden distinto hacían deadlock.
  FOR v_renglon IN
    SELECT r FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) AS r
    ORDER BY (r->>'factura_id')::uuid
  LOOP
    v_factura_id := (v_renglon->>'factura_id')::uuid;
    v_monto := ROUND(COALESCE((v_renglon->>'monto')::numeric, 0), 2);

    IF v_monto <= 0 THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_MONTO_INVALIDO: Cada factura del lote debe tener un importe mayor a cero.';
    END IF;

    -- Ola 1: las notas de crédito se restan CONVERTIDAS a la moneda de la
    -- factura (canon `public.nc_aplicadas_en_moneda_factura`); antes se sumaba
    -- `nc.monto` en crudo y una NC en USD inflaba el saldo de una factura MXN.
    SELECT
      f.total
      - COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                   WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL), 0)
      - public.nc_aplicadas_en_moneda_factura(f.id),
      f.fecha_emision
      INTO v_saldo, v_fecha_emision
    FROM public.facturas f
    WHERE f.id = v_factura_id
      AND f.deleted_at IS NULL
      AND f.organization_id = v_org
      AND f.cliente_id = v_cliente_id
      AND f.moneda = v_moneda
    FOR UPDATE OF f;

    IF v_saldo IS NULL THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_FACTURA_INVALIDA: Una de las facturas no existe, no es del cliente seleccionado o está en otra moneda.';
    END IF;

    -- Ola 11 · RFE-02/RNF-03: no cobros anteriores a la emisión (aging/REP).
    IF v_fecha < v_fecha_emision THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_FECHA_PREVIA_EMISION: La fecha del cobro es anterior a la emisión de una de las facturas del lote.'
        USING ERRCODE = '42501';
    END IF;

    -- BUG-15: tolerancia unificada con el trigger tg_pago_factura_no_sobrepago
    -- (0.005 = medio centavo). Antes 0.009 aquí y 0.005 en el trigger: la RPC
    -- aceptaba sobrepagos que el trigger luego rechazaba.
    IF v_monto > ROUND(v_saldo, 2) + 0.005 THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_EXCEDE_SALDO: El importe aplicado a una factura excede su saldo pendiente.';
    END IF;

    v_total := v_total + v_monto;
    v_n := v_n + 1;
  END LOOP;

  IF v_n < 2 THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_MINIMO_FACTURAS: Un cobro en lote requiere al menos dos facturas.';
  END IF;

  -- Ola 5 · RG4-5: el reparto debe cuadrar EXACTAMENTE con el importe recibido.
  IF v_importe IS NULL OR v_importe <= 0 THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_IMPORTE_REQUERIDO: Captura el importe recibido del cliente.'
      USING ERRCODE = '42501';
  END IF;
  -- Ola 11 · RNF-02: exacto tras ROUND a 2 decimales (antes tolerancia 0.01,
  -- discrepante con los 0.009 del cliente y con el mensaje "EXACTO").
  IF ROUND(v_importe, 2) IS DISTINCT FROM ROUND(v_total, 2) THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_IMPORTE_NO_CUADRA: El reparto (%) no cuadra con el importe recibido (%); no se permite sobrante sin asignar.', v_total, v_importe
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.pagos_factura_lote
    (organization_id, cliente_id, fecha_pago, moneda, monto_total, tipo_cambio_usd,
     forma_pago, referencia, cuenta_bancaria_id, notas, created_by)
  VALUES
    (v_org, v_cliente_id, v_fecha, v_moneda, v_total, v_tc,
     v_forma, v_referencia, v_cuenta_id, v_notas, v_uid)
  RETURNING id INTO v_lote_id;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    v_factura_id := (v_renglon->>'factura_id')::uuid;
    v_monto := ROUND(COALESCE((v_renglon->>'monto')::numeric, 0), 2);

    INSERT INTO public.pagos_factura
      (organization_id, factura_id, fecha_pago, monto, moneda, tipo_cambio,
       monto_aplicado_factura, forma_pago, referencia, notas, created_by, lote_id)
    VALUES
      -- Ola 11 · RBD-08: el pago individual guarda el TC del lote en moneda
      -- extranjera (garantizado > 0 por LC_COBRO_LOTE_TC_REQUERIDO); en MXN
      -- se conserva 1 como antes.
      (v_org, v_factura_id, v_fecha, v_monto, v_moneda,
       CASE WHEN v_moneda = 'MXN'::public.moneda THEN 1 ELSE v_tc END,
       v_monto, v_forma, v_referencia, v_notas, v_uid, v_lote_id)
    RETURNING id INTO v_pago_id;

    v_pagos := v_pagos || jsonb_build_object('pago_id', v_pago_id, 'factura_id', v_factura_id);
  END LOOP;

  IF v_cuenta_id IS NOT NULL THEN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
       cargo, abono, hash_dedupe, estado_conciliacion,
       pago_factura_lote_id, conciliado_por, conciliado_at, importado_por)
    VALUES
      (v_org, v_cuenta_id, v_fecha,
       'Cobro en lote (' || v_n || ' facturas) — ' || COALESCE(v_cliente_nombre, 'cliente'),
       v_referencia, 0, v_total, 'cobro-lote-' || v_lote_id::text, 'Conciliado',
       v_lote_id, v_uid, now(), v_uid);
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_org, v_uid, COALESCE(v_email,''), 'registrar_pago_cliente_lote', 'facturacion',
            v_lote_id, 'Cobro en lote ' || v_lote_id::text,
            jsonb_build_object('cliente_id', v_cliente_id, 'monto_total', v_total,
                               'importe_recibido', v_importe,
                               'moneda', v_moneda, 'facturas', v_n,
                               'cuenta_bancaria_id', v_cuenta_id, 'referencia', v_referencia));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_pago_cliente_lote: % %', SQLSTATE, SQLERRM;
  END;

  v_resp := jsonb_build_object('lote_id', v_lote_id, 'monto_total', v_total, 'pagos', v_pagos);
  -- Ola 11 · RNF-01: almacena la respuesta para los reintentos con la
  -- misma llave (no-op cuando request_id viene NULL).
  PERFORM public.idempotency_store(v_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_pago_cliente_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_cliente_lote(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.eliminar_pago_proveedor(_pago_id uuid, _motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pago record;
  v_baja int := 0;
  v_desvinculados int := 0;
  v_costos int := 0;
  v_anticipos int := 0;
BEGIN
  SELECT id, proveedor_factura_id, organization_id, deleted_at, monto, moneda
    INTO v_pago
  FROM public.pagos_proveedor
  WHERE id = _pago_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO: el pago % no existe', _pago_id USING ERRCODE = 'P0002';
  END IF;

  IF v_pago.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'pago_id', _pago_id, 'ya_eliminado', true,
      'movimientos_baja', 0, 'movimientos_desvinculados', 0, 'costos_recalculados', 0,
      'anticipos_revertidos', 0
    );
  END IF;

  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND v_pago.organization_id IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: el pago pertenece a otra organizacion'
      USING ERRCODE = '42501';
  END IF;

  -- Ola 8: el rol financiero se valida contra la membresía en la organización
  -- del pago (paridad de roles con es_escritor_financiero).
  IF NOT public.has_any_role_in_org(v_uid,
       ARRAY['admin','admin_org','contador','tesorero','ejecutivo_cobranza']::public.app_role[],
       v_pago.organization_id) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO: tu rol no puede eliminar pagos'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.pagos_proveedor
     SET deleted_at = now(), deleted_by = v_uid
   WHERE id = _pago_id AND deleted_at IS NULL;

  -- BUG-07 (auditoría 2026-08-18): si el pago venía de un anticipo, la
  -- aplicación debe revertirse en la MISMA transacción; el trigger
  -- `trg_anticipo_saldo` recalcula saldo_disponible y estado del anticipo.
  WITH rev AS (
    UPDATE public.anticipos_aplicaciones
       SET deleted_at = now(), deleted_by = v_uid, updated_at = now()
     WHERE pago_proveedor_id = _pago_id
       AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_anticipos FROM rev;

  WITH baja AS (
    UPDATE public.bbva_movimientos
       SET deleted_at = now(), deleted_by = v_uid
     WHERE deleted_at IS NULL
       AND (pago_proveedor_id = _pago_id OR hash_dedupe = 'pago-' || _pago_id::text)
       AND hash_dedupe = 'pago-' || _pago_id::text
    RETURNING 1
  )
  SELECT count(*) INTO v_baja FROM baja;

  WITH libre AS (
    UPDATE public.bbva_movimientos
       SET pago_proveedor_id = NULL,
           estado_conciliacion = 'Pendiente'::estado_conciliacion,
           conciliado_por = NULL,
           conciliado_at = NULL
     WHERE pago_proveedor_id = _pago_id
       AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_desvinculados FROM libre;

  SELECT count(DISTINCT pfc.concepto_costo_id) INTO v_costos
  FROM public.proveedor_facturas_conceptos pfc
  WHERE pfc.proveedor_factura_id = v_pago.proveedor_factura_id
    AND pfc.concepto_costo_id IS NOT NULL;

  INSERT INTO public.bitacora_actividad
    (usuario_id, usuario_email, accion, modulo, entidad_id, detalles, organization_id)
  VALUES (
    COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE((SELECT u.email FROM auth.users u WHERE u.id = v_uid), 'sistema'),
    'eliminar_pago', 'cxp', v_pago.proveedor_factura_id,
    jsonb_build_object(
      'pago_id', _pago_id,
      'monto', v_pago.monto,
      'moneda', v_pago.moneda,
      'motivo', _motivo,
      'movimientos_baja', v_baja,
      'movimientos_desvinculados', v_desvinculados,
      'costos_recalculados', v_costos,
      'anticipos_revertidos', v_anticipos,
      'atomico', true
    ),
    v_pago.organization_id
  );

  RETURN jsonb_build_object(
    'pago_id', _pago_id,
    'proveedor_factura_id', v_pago.proveedor_factura_id,
    'ya_eliminado', false,
    'movimientos_baja', v_baja,
    'movimientos_desvinculados', v_desvinculados,
    'costos_recalculados', v_costos,
    'anticipos_revertidos', v_anticipos
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.eliminar_pago_proveedor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_pago_proveedor(uuid, text) TO authenticated, service_role;