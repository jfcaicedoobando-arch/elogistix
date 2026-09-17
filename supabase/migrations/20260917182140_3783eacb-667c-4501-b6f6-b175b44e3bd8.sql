-- =============================================================
-- Lote MNY (P1) · Tesorería/Facturación
--   1) absorber_espejos_importacion: la línea real del estado de cuenta
--      sustituye al espejo del cobro en vez de sumarse aparte.
--   2) registrar_pago_factura_atomico: la misma llave de idempotencia con
--      payload distinto se rechaza (no "éxito silencioso").
--   3) tolerancia_conciliacion_moneda + assert_movimiento_pago_consistente:
--      la tolerancia de importe depende de la moneda (fail-closed).
-- =============================================================

-- ---------- 3a) Tolerancia canónica por moneda ----------
CREATE OR REPLACE FUNCTION public.tolerancia_conciliacion_moneda(p_moneda text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(btrim(COALESCE(p_moneda, '')))
           WHEN 'MXN' THEN 1.00
           WHEN 'USD' THEN 0.05
           WHEN 'EUR' THEN 0.05
           ELSE 0        -- moneda desconocida ⇒ coincidencia exacta
         END::numeric
$$;

REVOKE ALL ON FUNCTION public.tolerancia_conciliacion_moneda(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tolerancia_conciliacion_moneda(text) TO authenticated, service_role;

-- ---------- 1) Absorción del espejo de cobro al importar ----------
CREATE OR REPLACE FUNCTION public.absorber_espejos_importacion(
  p_cuenta_bancaria_id uuid,
  p_filas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_fila jsonb;
  v_cand uuid;
  v_cuantos int;
  v_absorbidos int := 0;
BEGIN
  SELECT organization_id INTO v_org
    FROM public.cuentas_bancarias
   WHERE id = p_cuenta_bancaria_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_CUENTA_NO_ENCONTRADA: la cuenta bancaria no existe o está dada de baja'
      USING ERRCODE = '22023';
  END IF;

  PERFORM public._assert_writer(v_org);

  FOR v_fila IN SELECT * FROM jsonb_array_elements(COALESCE(p_filas, '[]'::jsonb))
  LOOP
    -- Idempotencia: si la línea del archivo ya está guardada, no se toca nada.
    PERFORM 1 FROM public.bbva_movimientos
      WHERE cuenta_bancaria_id = p_cuenta_bancaria_id
        AND hash_dedupe = v_fila->>'hash_dedupe'
        AND deleted_at IS NULL;
    CONTINUE WHEN FOUND;

    -- Candidato: espejo de COBRO de cliente (hash 'cobro-<pago_id>'), mismo
    -- importe exacto al centavo y fecha dentro de ±3 días. Los espejos de pago
    -- a proveedor, anticipos y devoluciones NO se absorben (su hash forma parte
    -- de los candados de sentido).
    SELECT count(*), min(id) INTO v_cuantos, v_cand
      FROM public.bbva_movimientos m
     WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
       AND m.deleted_at IS NULL
       AND m.hash_dedupe LIKE 'cobro-%'
       AND m.pago_factura_id IS NOT NULL
       AND round(COALESCE(m.cargo, 0), 2) = round(COALESCE((v_fila->>'cargo')::numeric, 0), 2)
       AND round(COALESCE(m.abono, 0), 2) = round(COALESCE((v_fila->>'abono')::numeric, 0), 2)
       AND abs(m.fecha - (v_fila->>'fecha')::date) <= 3;

    -- Nunca se fusionan coincidencias ambiguas.
    CONTINUE WHEN COALESCE(v_cuantos, 0) <> 1;

    UPDATE public.bbva_movimientos
       SET hash_dedupe = v_fila->>'hash_dedupe',
           fecha = (v_fila->>'fecha')::date,
           concepto = COALESCE(NULLIF(v_fila->>'concepto', ''), concepto),
           referencia = COALESCE(NULLIF(v_fila->>'referencia', ''), referencia),
           saldo = COALESCE((v_fila->>'saldo')::numeric, saldo)
     WHERE id = v_cand;

    v_absorbidos := v_absorbidos + 1;

    PERFORM public.registrar_bitacora(
      'tesoreria', 'absorber_espejo_cobro_importacion', v_cand,
      COALESCE(v_fila->>'concepto', ''),
      jsonb_build_object('hash_dedupe', v_fila->>'hash_dedupe',
                         'cuenta_bancaria_id', p_cuenta_bancaria_id),
      v_org, auth.uid()
    );
  END LOOP;

  RETURN jsonb_build_object('absorbidos', v_absorbidos);
END;
$$;

REVOKE ALL ON FUNCTION public.absorber_espejos_importacion(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.absorber_espejos_importacion(uuid, jsonb) TO authenticated, service_role;

-- ---------- 2) Idempotencia estricta del cobro individual ----------
CREATE OR REPLACE FUNCTION public.registrar_pago_factura_atomico(
  p_factura_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_moneda text,
  p_tipo_cambio numeric,
  p_monto_aplicado_factura numeric,
  p_forma_pago text,
  p_referencia text DEFAULT ''::text,
  p_notas text DEFAULT ''::text,
  p_diferencia_cambiaria_mxn numeric DEFAULT 0,
  p_cuenta_bancaria_id uuid DEFAULT NULL,
  p_client_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_pago_id uuid;
  v_res jsonb;
  v_mov text := 'no_aplica';
  v_mov_id uuid;
  v_reintento boolean := false;
BEGIN
  -- D2: idempotencia por client_request_id. Un reintento de red devuelve el
  -- cobro existente y REPARA su movimiento bancario; nunca 23505.
  IF p_client_request_id IS NOT NULL THEN
    SELECT id INTO v_pago_id FROM public.pagos_factura
     WHERE client_request_id = p_client_request_id AND deleted_at IS NULL;
    IF v_pago_id IS NOT NULL THEN
      v_reintento := true;
      PERFORM public._assert_pago_factura_mismo_payload(
        v_pago_id, p_factura_id, p_fecha_pago, p_monto, p_moneda, p_tipo_cambio,
        p_monto_aplicado_factura, p_forma_pago, p_cuenta_bancaria_id);
    END IF;
  END IF;

  IF v_pago_id IS NULL THEN
    SELECT organization_id INTO v_org FROM public.facturas
     WHERE id = p_factura_id AND deleted_at IS NULL;
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'LC_FACTURA_NO_ENCONTRADA: la factura no existe o fue eliminada'
        USING ERRCODE = 'P0002';
    END IF;
    BEGIN
      INSERT INTO public.pagos_factura (
        organization_id, factura_id, fecha_pago, monto, moneda, tipo_cambio,
        monto_aplicado_factura, forma_pago, referencia, notas,
        diferencia_cambiaria_mxn, cuenta_bancaria_id, client_request_id, created_by
      ) VALUES (
        v_org, p_factura_id, p_fecha_pago, p_monto, p_moneda::moneda,
        COALESCE(p_tipo_cambio, 1), p_monto_aplicado_factura, p_forma_pago,
        COALESCE(p_referencia, ''), COALESCE(p_notas, ''),
        COALESCE(p_diferencia_cambiaria_mxn, 0), p_cuenta_bancaria_id,
        p_client_request_id, auth.uid()
      ) RETURNING id INTO v_pago_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_pago_id FROM public.pagos_factura
       WHERE client_request_id = p_client_request_id AND deleted_at IS NULL;
      IF v_pago_id IS NULL THEN RAISE; END IF;
      v_reintento := true;
      PERFORM public._assert_pago_factura_mismo_payload(
        v_pago_id, p_factura_id, p_fecha_pago, p_monto, p_moneda, p_tipo_cambio,
        p_monto_aplicado_factura, p_forma_pago, p_cuenta_bancaria_id);
    END;
  END IF;

  -- El abono bancario vive en la MISMA transacción que el cobro: si no se
  -- puede registrar, el cobro tampoco se persiste (antes quedaba huérfano).
  SELECT cuenta_bancaria_id INTO p_cuenta_bancaria_id
    FROM public.pagos_factura WHERE id = v_pago_id;
  IF p_cuenta_bancaria_id IS NOT NULL THEN
    v_res := public.asegurar_movimiento_cobro_factura(v_pago_id);
    v_mov_id := NULLIF(v_res->>'movimiento_id', '')::uuid;
    IF (v_res->>'creado')::boolean IS TRUE OR v_res->>'motivo' = 'ya_existe' THEN
      v_mov := 'creado';
    ELSIF v_res->>'motivo' = 'pago_anulado' THEN
      v_mov := 'no_aplica';
    ELSE
      RAISE EXCEPTION 'LC_COBRO_MOVIMIENTO_FALLIDO: no se pudo registrar el abono bancario del cobro (%)',
        COALESCE(v_res->>'motivo', 'motivo desconocido') USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'pago_id', v_pago_id, 'movimiento_bancario', v_mov,
    'movimiento_id', v_mov_id, 'reintento', v_reintento);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pago_factura_atomico(uuid, date, numeric, text, numeric, numeric, text, text, text, numeric, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_factura_atomico(uuid, date, numeric, text, numeric, numeric, text, text, text, numeric, uuid, uuid) TO authenticated, service_role;

-- Comparador del payload de un reintento de cobro individual.
CREATE OR REPLACE FUNCTION public._assert_pago_factura_mismo_payload(
  p_pago_id uuid,
  p_factura_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_moneda text,
  p_tipo_cambio numeric,
  p_monto_aplicado_factura numeric,
  p_forma_pago text,
  p_cuenta_bancaria_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_p public.pagos_factura%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.pagos_factura WHERE id = p_pago_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_p.factura_id IS DISTINCT FROM p_factura_id
     OR v_p.fecha_pago IS DISTINCT FROM p_fecha_pago
     OR round(COALESCE(v_p.monto, 0), 4) IS DISTINCT FROM round(COALESCE(p_monto, 0), 4)
     OR v_p.moneda::text IS DISTINCT FROM upper(btrim(COALESCE(p_moneda, '')))
     OR round(COALESCE(v_p.tipo_cambio, 1), 6) IS DISTINCT FROM round(COALESCE(p_tipo_cambio, 1), 6)
     OR round(COALESCE(v_p.monto_aplicado_factura, 0), 4) IS DISTINCT FROM round(COALESCE(p_monto_aplicado_factura, 0), 4)
     OR COALESCE(v_p.forma_pago, '') IS DISTINCT FROM COALESCE(p_forma_pago, '')
     OR v_p.cuenta_bancaria_id IS DISTINCT FROM p_cuenta_bancaria_id
  THEN
    RAISE EXCEPTION 'LC_PAGO_REINTENTO_DISTINTO: ese intento ya se guardó con datos distintos (cobro %). Revisa el cobro registrado antes de volver a capturarlo; no se guardó la edición ni se duplicó el cobro.', p_pago_id
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_pago_factura_mismo_payload(uuid, uuid, date, numeric, text, numeric, numeric, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._assert_pago_factura_mismo_payload(uuid, uuid, date, numeric, text, numeric, numeric, text, uuid) TO authenticated, service_role;

-- ---------- 3b) Trigger de consistencia con tolerancia por moneda ----------
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
  v_tol numeric := 0; -- MNY P1.3: tolerancia según la MONEDA del movimiento
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
    v_tol := public.tolerancia_conciliacion_moneda(COALESCE(v_cuenta_moneda, v_pago_moneda));
    v_mov := GREATEST(COALESCE(NEW.abono,0), COALESCE(NEW.cargo,0));
    IF v_mov > 0 AND v_pago_monto > 0 AND abs(v_mov - v_pago_monto) > v_tol THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el movimiento por % no coincide con el pago por % (tolerancia % %)',
        v_mov, v_pago_monto, v_tol, COALESCE(v_cuenta_moneda, v_pago_moneda, 'moneda desconocida')
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

    v_tol := public.tolerancia_conciliacion_moneda(COALESCE(v_cuenta_moneda, v_pago_moneda));
    v_mov := GREATEST(COALESCE(NEW.cargo,0), COALESCE(NEW.abono,0));
    IF v_mov > 0 AND v_pago_monto > 0 AND abs(v_mov - v_pago_monto) > v_tol THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el movimiento por % no coincide con el pago por % (tolerancia % %)',
        v_mov, v_pago_monto, v_tol, COALESCE(v_cuenta_moneda, v_pago_moneda, 'moneda desconocida')
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

      v_tol := public.tolerancia_conciliacion_moneda(COALESCE(v_cuenta_moneda, v_pago_moneda));
      IF abs(COALESCE(NEW.abono, 0) - v_ant_devuelto) > v_tol THEN
        RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el depósito por % no coincide con el monto devuelto del anticipo % (tolerancia % %)',
          COALESCE(NEW.abono, 0), v_ant_devuelto, v_tol, COALESCE(v_cuenta_moneda, v_pago_moneda, 'moneda desconocida')
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