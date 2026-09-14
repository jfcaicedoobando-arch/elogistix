-- N8 (v13.823.390): la UI ya filtraba cuentas, pero la RPC SECURITY DEFINER
-- aceptaba cualquier cuenta existente: se podía registrar un pago contra una
-- cuenta de OTRA organización o dada de baja lógica de operación (activa=false).
-- Se valida antes de insertar el pago y, como defensa en profundidad, al
-- asegurar el movimiento bancario.

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
  v_emision  date;
  v_hoy_mx   date := public.fecha_negocio_mx();
  v_pago_id  uuid;
  v_mov_id   uuid;
  v_reintento boolean := false;
  v_cta_org  uuid;
  v_cta_activa boolean;
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

  SELECT organization_id, fecha_emision INTO v_org, v_emision
    FROM public.proveedor_facturas
   WHERE id = p_factura_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: la factura de proveedor no existe o fue eliminada' USING ERRCODE = 'P0001';
  END IF;

  -- N8: la cuenta bancaria debe existir, estar activa y ser de la MISMA
  -- organización que la factura. Se bloquea la fila para que no la den de baja
  -- entre la validación y el insert.
  IF p_cuenta_bancaria_id IS NOT NULL THEN
    SELECT organization_id, activa INTO v_cta_org, v_cta_activa
      FROM public.cuentas_bancarias
     WHERE id = p_cuenta_bancaria_id AND deleted_at IS NULL
     FOR UPDATE;
    IF v_cta_org IS NULL THEN
      RAISE EXCEPTION 'LC_PAGO_CUENTA_INEXISTENTE: la cuenta bancaria no existe o está dada de baja' USING ERRCODE = 'P0001';
    END IF;
    IF v_cta_org <> v_org THEN
      RAISE EXCEPTION 'LC_PAGO_CUENTA_OTRA_ORG: la cuenta bancaria pertenece a otra organización' USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_cta_activa THEN
      RAISE EXCEPTION 'LC_PAGO_CUENTA_INACTIVA: la cuenta bancaria está inactiva y no admite pagos' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- D4: canon de fecha de negocio México, igual que el lote.
  IF p_fecha_pago IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_INVALIDA: captura la fecha del pago' USING ERRCODE = '22023';
  END IF;
  IF p_fecha_pago > v_hoy_mx THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_FUTURA: la fecha del pago (%) no puede ser futura', p_fecha_pago
      USING ERRCODE = '22023';
  END IF;
  IF v_emision IS NOT NULL AND p_fecha_pago < v_emision THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_PREVIA_EMISION: la fecha del pago (%) es anterior a la emisión de la factura (%)',
      p_fecha_pago, v_emision USING ERRCODE = '22023';
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
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_atomico(uuid, date, numeric, text, text, text, uuid, text, numeric, numeric, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._asegurar_movimiento_pago_proveedor(p_pago_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_pago       public.pagos_proveedor;
  v_cuenta_mon text;
  v_cuenta_org uuid;
  v_cuenta_act boolean;
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
  -- N8: defensa en profundidad. La cuenta del movimiento debe existir, estar
  -- activa y ser de la misma organización del pago.
  SELECT moneda::text, organization_id, activa
    INTO v_cuenta_mon, v_cuenta_org, v_cuenta_act
    FROM public.cuentas_bancarias
   WHERE id = v_pago.cuenta_bancaria_id AND deleted_at IS NULL;
  IF v_cuenta_mon IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_SIN_CUENTA: la cuenta bancaria del pago no existe o está dada de baja' USING ERRCODE = 'P0001';
  END IF;
  IF v_cuenta_org IS DISTINCT FROM v_pago.organization_id THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_CUENTA_OTRA_ORG: la cuenta bancaria del pago pertenece a otra organización' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_cuenta_act THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_CUENTA_INACTIVA: la cuenta bancaria del pago está inactiva' USING ERRCODE = 'P0001';
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
  -- Sentry JAVASCRIPT-REACT-65/66 (42P10): el índice único vivo es
  -- (cuenta_bancaria_id, hash_dedupe) WHERE deleted_at IS NULL; el target
  -- anterior `(hash_dedupe)` no coincidía con ningún constraint y abortaba
  -- todo el registro del pago.
  ON CONFLICT (cuenta_bancaria_id, hash_dedupe) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_mov_id;
  IF v_mov_id IS NULL THEN
    SELECT id INTO v_mov_id FROM public.bbva_movimientos
     WHERE cuenta_bancaria_id = v_pago.cuenta_bancaria_id
       AND hash_dedupe = 'pago-' || p_pago_id::text
       AND deleted_at IS NULL
     LIMIT 1;
  END IF;
  RETURN v_mov_id;
END;
$$;

REVOKE ALL ON FUNCTION public._asegurar_movimiento_pago_proveedor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._asegurar_movimiento_pago_proveedor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._asegurar_movimiento_pago_proveedor(uuid) TO authenticated, service_role;