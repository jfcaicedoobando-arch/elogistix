-- Fuente canónica. Espejo 1:1 de la migración v13.823.32 (ola de pulido CxP/cotización→embarque/CRM).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

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
