-- ============================================================
-- Ola 11 · RBD-08: los pagos individuales del cobro en lote se insertaban
-- con pagos_factura.tipo_cambio = 1 duro aunque el lote capturaba TC. En
-- USD/EUR eso subestima monto_cobrado_mxn en calcular_comision_pago (rama
-- v_tc_pago = 1 ⇒ monto extranjero contado como MXN). Ahora se guarda el
-- TC del lote (v_tc) cuando la moneda es extranjera; en MXN se conserva 1.
-- Es seguro porque desde RFE-03 (20260821030200) la RPC exige v_tc > 0
-- para moneda extranjera (LC_COBRO_LOTE_TC_REQUERIDO).
-- ACUMULATIVA: incluye RFE-02/RNF-03 (fecha), RFE-03 (TC requerido),
-- RNF-01 (idempotencia) y RNF-02 (cuadre exacto). Sincroniza la fuente
-- canónica (1:1). Sin backfill de históricos en esta migración.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_pago_cliente_lote(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_autorizado boolean;
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

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_SIN_ROL: Sólo administración, contabilidad o tesorería pueden registrar cobros en lote.'
      USING ERRCODE = '42501';
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
  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    v_factura_id := (v_renglon->>'factura_id')::uuid;
    v_monto := ROUND(COALESCE((v_renglon->>'monto')::numeric, 0), 2);

    IF v_monto <= 0 THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_MONTO_INVALIDO: Cada factura del lote debe tener un importe mayor a cero.';
    END IF;

    SELECT
      f.total
      - COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                   WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL), 0)
      - COALESCE((SELECT SUM(nc.monto) FROM public.factura_notas_credito nc
                   WHERE nc.factura_id = f.id AND nc.estado = 'Aplicada' AND nc.deleted_at IS NULL), 0),
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

    IF v_monto > ROUND(v_saldo, 2) + 0.009 THEN
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

-- FIX-H6-12: REVOKE/GRANT explícitos tras recrear una SECURITY DEFINER.
REVOKE ALL ON FUNCTION public.registrar_pago_cliente_lote(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_pago_cliente_lote(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_cliente_lote(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_cliente_lote(jsonb) TO service_role;

-- ============================================================
-- Ola 11 · RNF-06 (espejo RG4-6 de CxC): una misma factura no puede
-- aparecer dos veces en el reparto del lote CxP — dos renglones a la
-- misma factura pasaban el chequeo individual y podían sobre-aplicar el
-- pago (sólo fallaban si la suma excedía el saldo). Mismo chequeo que
-- LC_COBRO_LOTE_FACTURA_DUPLICADA. El guard RG4-12 (lote duplicado en
-- 10 min) es del lado cliente (pagoProveedorLote.ts), igual que en CxC.
-- ACUMULATIVA: incluye RFE-02/RNF-03 (fecha) y RNF-05 (importe + cuadre).
-- Sin cambio de firma: (p_payload jsonb).
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_pago_proveedor_lote(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_autorizado boolean;
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
  v_cuenta public.cuentas_bancarias;
  v_proveedor_nombre text;
  v_total numeric := 0;
  v_lote_id uuid;
  v_renglon jsonb;
  v_fecha_emision date;
  v_n int := 0;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_LOTE_SIN_ROL: Sólo administración, contabilidad o tesorería pueden registrar pagos en lote.'
      USING ERRCODE = '42501';
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

  -- Ola 11 · RFE-02/RNF-03: misma regla que el pago individual.
  IF v_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_LOTE_FECHA_FUTURA: La fecha del pago no puede ser futura.'
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
  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    IF COALESCE((v_renglon->>'monto')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_LOTE_MONTO_INVALIDO: Cada factura del lote debe tener un importe mayor a cero.';
    END IF;

    -- Ola 11 · RFE-02/RNF-03: el SELECT sirve doble — valida que la factura
    -- exista/sea del proveedor y trae fecha_emision para el guard de fecha.
    SELECT pf.fecha_emision INTO v_fecha_emision
    FROM public.proveedor_facturas pf
    WHERE pf.id = (v_renglon->>'factura_id')::uuid
      AND pf.deleted_at IS NULL
      AND pf.organization_id = v_org
      AND pf.proveedor_id = v_proveedor_id;

    IF v_fecha_emision IS NULL THEN
      RAISE EXCEPTION 'LC_LOTE_FACTURA_INVALIDA: Una de las facturas no existe o no pertenece al proveedor seleccionado.';
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

  RETURN v_lote_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) TO service_role;