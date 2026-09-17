-- Lote MNY anticipos/lote P1
-- 1) La devolución de un anticipo es un ABONO legítimo (el proveedor regresa el
--    dinero). assert_movimiento_pago_consistente sólo aceptaba cargo para
--    anticipos, así que devolver_anticipo_proveedor hacía rollback siempre.
--    Se acepta el abono únicamente como devolución genuina: anticipo en estado
--    'devuelto', misma org/moneda (reglas previas), hash 'devolucion-<id>' y
--    abono igual a monto_devuelto. El anticipo original sigue exigiendo cargo.
-- 2) registrar_pago_proveedor_lote ignora de forma autoritativa la cuenta
--    bancaria cuando el método es Efectivo (cargo bancario fantasma).

CREATE OR REPLACE FUNCTION public.assert_movimiento_pago_consistente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago_org uuid;
  v_pago_moneda text;
  v_pago_monto numeric;
  v_cuenta_moneda text;
  v_vinculos int;
  v_mov numeric;
  v_ant_estado text;
  v_ant_devuelto numeric;
  v_es_devolucion boolean := false;
  c_tol constant numeric := 1.00; -- tolerancia en la moneda del movimiento
BEGIN
  v_vinculos :=
      (CASE WHEN NEW.pago_factura_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.anticipo_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_lote_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_factura_lote_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.traspaso_id IS NOT NULL THEN 1 ELSE 0 END);

  IF v_vinculos > 1 THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_DOBLE_VINCULO: un movimiento no puede vincularse a más de un origen (pago de factura, pago de proveedor, lote de pago, anticipo o traspaso)'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.cuenta_bancaria_id IS NOT NULL THEN
    SELECT moneda::text INTO v_cuenta_moneda
    FROM public.cuentas_bancarias
    WHERE id = NEW.cuenta_bancaria_id AND deleted_at IS NULL;
  END IF;

  IF NEW.pago_factura_id IS NOT NULL THEN
    SELECT organization_id, moneda::text, COALESCE(monto,0)
      INTO v_pago_org, v_pago_moneda, v_pago_monto
    FROM public.pagos_factura
    WHERE id = NEW.pago_factura_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de factura % no existe o está eliminado', NEW.pago_factura_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de factura pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: un cobro de cliente entra a la cuenta (abono), nunca sale.
    IF COALESCE(NEW.abono, 0) <= 0 OR COALESCE(NEW.cargo, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_COBRO: un cobro de cliente sólo puede vincularse a un depósito (abono) en la cuenta, no a un cargo'
        USING ERRCODE = 'P0001';
    END IF;

    -- N11: cobro ⇒ abono en la cuenta.
    v_mov := GREATEST(COALESCE(NEW.abono,0), COALESCE(NEW.cargo,0));
    IF v_mov > 0 AND v_pago_monto > 0 AND abs(v_mov - v_pago_monto) > c_tol THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el movimiento por % no coincide con el pago por % (tolerancia %)',
        v_mov, v_pago_monto, c_tol
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text, COALESCE(monto,0)
      INTO v_pago_org, v_pago_moneda, v_pago_monto
    FROM public.pagos_proveedor
    WHERE id = NEW.pago_proveedor_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de proveedor % no existe o está eliminado', NEW.pago_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de proveedor pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: un pago a proveedor sale de la cuenta (cargo), nunca entra.
    IF COALESCE(NEW.cargo, 0) <= 0 OR COALESCE(NEW.abono, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_PAGO: un pago a proveedor sólo puede vincularse a un retiro (cargo) de la cuenta, no a un abono'
        USING ERRCODE = 'P0001';
    END IF;

    v_mov := GREATEST(COALESCE(NEW.cargo,0), COALESCE(NEW.abono,0));
    IF v_mov > 0 AND v_pago_monto > 0 AND abs(v_mov - v_pago_monto) > c_tol THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el movimiento por % no coincide con el pago por % (tolerancia %)',
        v_mov, v_pago_monto, c_tol
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_lote_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_proveedor_lote
    WHERE id = NEW.pago_proveedor_lote_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_LOTE_INEXISTENTE: el lote de pago % no existe o está eliminado', NEW.pago_proveedor_lote_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de pago pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del lote (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: el lote de pago a proveedores también es salida de dinero.
    IF COALESCE(NEW.cargo, 0) <= 0 OR COALESCE(NEW.abono, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_PAGO: un pago en lote a proveedores sólo puede vincularse a un retiro (cargo) de la cuenta, no a un abono'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_factura_lote_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_factura_lote
    WHERE id = NEW.pago_factura_lote_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_LOTE_COBRO_INEXISTENTE: el lote de cobro % no existe o está eliminado', NEW.pago_factura_lote_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de cobro pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del lote de cobro (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: el lote de cobro a clientes entra a la cuenta.
    IF COALESCE(NEW.abono, 0) <= 0 OR COALESCE(NEW.cargo, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_COBRO: un cobro en lote a clientes sólo puede vincularse a un depósito (abono) en la cuenta, no a un cargo'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.anticipo_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text, estado::text, COALESCE(monto_devuelto, 0)
      INTO v_pago_org, v_pago_moneda, v_ant_estado, v_ant_devuelto
    FROM public.anticipos_proveedor
    WHERE id = NEW.anticipo_proveedor_id;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ANTICIPO_INEXISTENTE: el anticipo % no existe', NEW.anticipo_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el anticipo pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del anticipo (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- MNY P1.1 (lote anticipos): la DEVOLUCIÓN de un anticipo sí es un abono
    -- (el proveedor regresa el dinero). Se acepta sólo como devolución genuina:
    -- anticipo en estado `devuelto`, hash de devolución esperado y abono igual
    -- al monto_devuelto. El anticipo ORIGINAL sigue exigiendo cargo.
    v_es_devolucion := NEW.hash_dedupe = 'devolucion-' || NEW.anticipo_proveedor_id::text;

    IF v_es_devolucion THEN
      IF v_ant_estado IS DISTINCT FROM 'devuelto' THEN
        RAISE EXCEPTION 'LC_MOVIMIENTO_ANTICIPO_DEVOLUCION_INVALIDA: el anticipo % no está devuelto; un abono sólo procede como devolución registrada', NEW.anticipo_proveedor_id
          USING ERRCODE = 'P0001';
      END IF;

      IF COALESCE(NEW.abono, 0) <= 0 OR COALESCE(NEW.cargo, 0) <> 0 THEN
        RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_DEVOLUCION: la devolución de un anticipo sólo puede vincularse a un depósito (abono) en la cuenta, no a un cargo'
          USING ERRCODE = 'P0001';
      END IF;

      IF abs(COALESCE(NEW.abono, 0) - v_ant_devuelto) > c_tol THEN
        RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el depósito por % no coincide con el monto devuelto del anticipo % (tolerancia %)',
          COALESCE(NEW.abono, 0), v_ant_devuelto, c_tol
          USING ERRCODE = 'P0001';
      END IF;
    ELSE
      -- N5: el anticipo a proveedor es salida de dinero.
      IF COALESCE(NEW.cargo, 0) <= 0 OR COALESCE(NEW.abono, 0) <> 0 THEN
        RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_PAGO: un anticipo a proveedor sólo puede vincularse a un retiro (cargo) de la cuenta, no a un abono'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_movimiento_pago_consistente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_movimiento_pago_consistente() TO authenticated, service_role;

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
  v_fecha date := COALESCE((p_payload->>'fecha_pago')::date, public.fecha_negocio_mx());
  v_moneda public.moneda := (p_payload->>'moneda')::public.moneda;
  v_tc numeric := NULLIF(p_payload->>'tipo_cambio_usd','')::numeric;
  -- Ola 11 · RNF-05: importe real de la transferencia (nuevo en el payload).
  v_importe numeric := NULLIF(p_payload->>'importe_recibido','')::numeric;
  v_metodo text := COALESCE(NULLIF(TRIM(p_payload->>'metodo_pago'), ''), 'Transferencia');
  v_referencia text := COALESCE(NULLIF(TRIM(p_payload->>'referencia'), ''), '');
  -- MNY P1.2: Efectivo NUNCA genera salida bancaria. Si el cliente manda una
  -- cuenta obsoleta (selector no limpiado al cambiar de método), se ignora de
  -- forma autoritativa para no crear un cargo bancario fantasma.
  v_cuenta_id uuid := CASE
    WHEN COALESCE(NULLIF(TRIM(p_payload->>'metodo_pago'), ''), 'Transferencia') = 'Efectivo'
      THEN NULL
    ELSE NULLIF(p_payload->>'cuenta_bancaria_id','')::uuid
  END;
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

  -- Ola 8 + FIX B-6: el rol financiero debe venir de la membresía en ESTA
  -- organización (antes: EXISTS global sobre user_roles — un contador de la
  -- org A podía registrar pagos en la org B), con la lista EXACTA previa al
  -- piloto {admin, admin_org, super_admin, contador, tesorero} y SIN expansión
  -- de jerarquía: `auxiliar_contable` queda fuera por decisión conservadora.
  -- super_admin conserva su bypass de plataforma dentro del helper.
  IF NOT public.has_any_role_in_org_exact(v_uid,
       ARRAY['admin','admin_org','super_admin','contador','tesorero']::public.app_role[],
       v_org) THEN
    RAISE EXCEPTION 'LC_LOTE_SIN_ROL: Sólo administración, contabilidad o tesorería pueden registrar pagos en lote.'
      USING ERRCODE = '42501';
  END IF;

  -- Ola 11 · RFE-02/RNF-03: misma regla que el pago individual.
  IF v_fecha > public.fecha_negocio_mx() THEN
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
