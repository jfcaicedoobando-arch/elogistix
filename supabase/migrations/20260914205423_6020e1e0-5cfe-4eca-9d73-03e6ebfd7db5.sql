-- N7 (v13.823.390): un REP cancelado/revertido NO consume saldo. El canon
-- (public._saldo_factura_calc y public.cartera_pendiente) ya excluye
-- public.pago_rep_anulado(estado_rep), pero el trigger de sobrepago y el cobro
-- en lote sumaban pagos_factura en bruto: tras cancelar un REP la UI mostraba
-- saldo y la BD rechazaba el cobro de reemplazo como sobrepago.

CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_pago()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado text;
  v_cancel text;
  v_total numeric;
  v_fecha_emision date;
  v_pagos_otros numeric;
  v_ncs numeric;
  v_saldo_disponible_previo numeric;
  v_saldo_post numeric;
  v_solo_metadatos boolean := false;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- FIX-63: un UPDATE que NO toca el dinero (p. ej. sincronizar el estatus del
  -- REP ante el SAT, adjuntar PDF/XML o marcar el acuse) es mantenimiento
  -- documental, no un cobro nuevo. Esos updates deben pasar aunque la factura
  -- esté cancelada o con cancelación en trámite.
  IF TG_OP = 'UPDATE' THEN
    v_solo_metadatos := (
      NEW.factura_id IS NOT DISTINCT FROM OLD.factura_id
      AND NEW.monto IS NOT DISTINCT FROM OLD.monto
      AND NEW.monto_aplicado_factura IS NOT DISTINCT FROM OLD.monto_aplicado_factura
      AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
      AND NEW.tipo_cambio IS NOT DISTINCT FROM OLD.tipo_cambio
      AND NEW.ret_isr IS NOT DISTINCT FROM OLD.ret_isr
      AND NEW.ret_iva IS NOT DISTINCT FROM OLD.ret_iva
      -- FIX3 (M-4): un cambio de fecha ya no es "sólo metadatos".
      AND NEW.fecha_pago IS NOT DISTINCT FROM OLD.fecha_pago
      AND OLD.deleted_at IS NULL
    );
    IF v_solo_metadatos THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Ola 1: espejo de LC_LOTE_FECHA_FUTURA (cobro en lote). Un cobro con fecha
  -- futura ensucia aging, REP y reportes de flujo.
  -- FIX3 (M-4): aplica también en UPDATE.
  IF NEW.fecha_pago IS NOT NULL AND NEW.fecha_pago > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_FUTURA: la fecha del cobro no puede ser futura'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('fecha_pago', NEW.fecha_pago)::text;
  END IF;

  -- FIX-23: bloquear la factura padre para serializar pagos concurrentes.
  PERFORM 1 FROM public.facturas WHERE id = NEW.factura_id FOR UPDATE;

  SELECT estado::text, COALESCE(total, 0), COALESCE(cancellation_status, 'none'),
         fecha_emision
    INTO v_estado, v_total, v_cancel, v_fecha_emision
  FROM public.facturas
  WHERE id = NEW.factura_id;

  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN
    RAISE EXCEPTION 'LC_PAGO_FACTURA_NO_VIVA: la factura está en estado % y no admite pagos', v_estado
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('estado_factura', v_estado)::text;
  END IF;

  IF v_cancel IN ('pending','verifying') THEN
    RAISE EXCEPTION 'LC_FACTURA_EN_CANCELACION: la factura tiene una cancelación en trámite ante el SAT y no admite cobros'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('cancellation_status', v_cancel)::text;
  END IF;

  -- FIX3 (M-4): paridad con el lote CxC — el cobro no puede ser anterior a la
  -- emisión de la factura. Facturas sin fecha_emision quedan fuera de la regla.
  IF NEW.fecha_pago IS NOT NULL
     AND v_fecha_emision IS NOT NULL
     AND NEW.fecha_pago < v_fecha_emision THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_PREVIA_EMISION: la fecha del cobro no puede ser anterior a la emisión de la factura'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'fecha_pago', NEW.fecha_pago,
              'fecha_emision', v_fecha_emision
            )::text;
  END IF;

  -- N7 (v13.823.390): un pago cuyo REP quedó CANCELADO ante el SAT está
  -- ANULADO y NO consume saldo (mismo predicado canónico que
  -- public._saldo_factura_calc y cartera_pendiente). Sin este filtro, tras
  -- cancelar un REP la UI mostraba saldo pero la BD rechazaba el cobro de
  -- reemplazo como sobrepago.
  SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) INTO v_pagos_otros
  FROM public.pagos_factura pf
  WHERE pf.factura_id = NEW.factura_id
    AND pf.deleted_at IS NULL
    AND NOT public.pago_rep_anulado(pf.estado_rep)
    AND pf.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Ola 1: NC convertidas a la moneda de la factura (antes SUM(monto) crudo).
  v_ncs := public.nc_aplicadas_en_moneda_factura(NEW.factura_id);

  v_saldo_disponible_previo := v_total - v_pagos_otros - v_ncs;
  v_saldo_post := v_saldo_disponible_previo - COALESCE(NEW.monto_aplicado_factura, 0);

  IF v_saldo_post < -0.005 THEN
    RAISE EXCEPTION 'LC_PAGO_SOBREPAGO: el pago excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'saldo_disponible', v_saldo_disponible_previo,
              'monto_intentado', NEW.monto_aplicado_factura,
              'notas_credito_aplicadas', v_ncs
            )::text;
  END IF;

  RETURN NEW;
END;
$function$;

-- FIX-45: ninguna función financiera es ejecutable por anon.
REVOKE ALL ON FUNCTION public.assert_factura_viva_para_pago() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_factura_viva_para_pago() FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_factura_viva_para_pago() TO service_role;

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
  v_fecha date := COALESCE((p_payload->>'fecha_pago')::date, public.fecha_negocio_mx());
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

  -- Ola 8 + FIX B-6: rol financiero por membresía en la organización del
  -- cliente, con la lista EXACTA previa al piloto {admin, admin_org,
  -- super_admin, contador, tesorero} y SIN expansión de jerarquía:
  -- `auxiliar_contable` queda fuera por decisión conservadora.
  IF NOT public.has_any_role_in_org_exact(v_uid,
       ARRAY['admin','admin_org','super_admin','contador','tesorero']::public.app_role[],
       v_org) THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_SIN_ROL: Sólo administración, contabilidad o tesorería pueden registrar cobros en lote.'
      USING ERRCODE = '42501';
  END IF;

  -- Ola 11 · RFE-02/RNF-03: misma regla que el cobro individual (FE-03).
  IF v_fecha > public.fecha_negocio_mx() THEN
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
                   WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
                     -- N7 (v13.823.390): REP cancelado = pago ANULADO, no
                     -- consume saldo (canon public.pago_rep_anulado).
                     AND NOT public.pago_rep_anulado(pf.estado_rep)), 0)
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