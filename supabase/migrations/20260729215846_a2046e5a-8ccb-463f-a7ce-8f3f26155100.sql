CREATE OR REPLACE FUNCTION public.ejecutar_pago_programado(
  p_factura_id uuid,
  p_cuenta_bancaria_id uuid,
  p_fecha date,
  p_monto numeric,
  p_metodo_pago text DEFAULT 'Transferencia',
  p_referencia text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_autorizado boolean;
  v_org uuid;
  v_factura public.proveedor_facturas;
  v_cuenta public.cuentas_bancarias;
  v_saldo_cuenta numeric;
  v_pago public.pagos_proveedor;
  v_mov_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: Tu rol no puede ejecutar pagos programados.';
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

  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = v_org AND om.user_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'LC_CXP_EMBARQUE_ORG_MISMATCH: La factura pertenece a otra organización.';
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

  SELECT v_cuenta.saldo_inicial
       + COALESCE((SELECT SUM(abono) FROM public.bbva_movimientos WHERE cuenta_bancaria_id = v_cuenta.id), 0)
       - COALESCE((SELECT SUM(cargo) FROM public.bbva_movimientos WHERE cuenta_bancaria_id = v_cuenta.id), 0)
    INTO v_saldo_cuenta;

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

  RETURN jsonb_build_object(
    'pago_id', v_pago.id,
    'movimiento_id', v_mov_id,
    'saldo_cuenta_restante', v_saldo_cuenta - p_monto
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ejecutar_pago_programado(uuid, uuid, date, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ejecutar_pago_programado(uuid, uuid, date, numeric, text, text) TO authenticated;