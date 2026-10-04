-- Sólo helpers temporales de las suites AUD40; incluir dentro BEGIN/ROLLBACK.
CREATE OR REPLACE FUNCTION pg_temp.audit40_espejo(
  p_org uuid, p_cuenta uuid, p_monto numeric, p_fecha date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente uuid;
  v_factura uuid;
  v_pago uuid;
  v_movimiento uuid;
BEGIN
  INSERT INTO public.clientes(organization_id, nombre, email)
  VALUES (p_org, 'AUD40 CLIENTE', 'audit40-' || gen_random_uuid() || '@test.local')
  RETURNING id INTO v_cliente;
  INSERT INTO public.facturas(
    organization_id, cliente_id, cliente_nombre, numero, fecha_emision,
    fecha_vencimiento, moneda, subtotal, iva, total, estado, metodo_pago
  ) VALUES (p_org, v_cliente, 'AUD40 CLIENTE', 'AUD40-' || gen_random_uuid(),
            p_fecha - 3, p_fecha + 30, 'MXN', p_monto, 0, p_monto, 'Emitida', 'PPD')
  RETURNING id INTO v_factura;
  INSERT INTO public.pagos_factura(
    organization_id, factura_id, fecha_pago, monto, moneda, tipo_cambio,
    monto_aplicado_factura, forma_pago, cuenta_bancaria_id
  ) VALUES (p_org, v_factura, p_fecha, p_monto, 'MXN', 1, p_monto,
            'Transferencia', p_cuenta) RETURNING id INTO v_pago;
  SELECT id INTO v_movimiento FROM public.bbva_movimientos
  WHERE pago_factura_id = v_pago AND deleted_at IS NULL;
  -- Mantener triggers reales: si el flujo de pago no genera su espejo en
  -- esta fixture, construirlo con el pago real y los guards activos.
  IF v_movimiento IS NULL THEN
    INSERT INTO public.bbva_movimientos(
      organization_id, cuenta_bancaria_id, fecha, cargo, abono,
      hash_dedupe, pago_factura_id, estado_conciliacion
    ) VALUES (p_org, p_cuenta, p_fecha, 0, p_monto,
              'cobro-' || v_pago, v_pago, 'Conciliado') RETURNING id INTO v_movimiento;
  END IF;
  RETURN v_movimiento;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.audit40_fila(p_movimiento uuid, p_hash text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'fecha', m.fecha, 'cargo', m.cargo, 'abono', m.abono,
    'concepto', 'AUD40 BANCO', 'referencia', 'AUD40 REF', 'saldo', 1234,
    'hash_dedupe', p_hash, 'espejo_revisado_id', m.id,
    'espejo_revisado_huella', jsonb_build_object(
      'cuenta_bancaria_id', m.cuenta_bancaria_id, 'hash_dedupe', m.hash_dedupe,
      'pago_factura_id', m.pago_factura_id, 'fecha', m.fecha, 'cargo', m.cargo, 'abono', m.abono))
  FROM public.bbva_movimientos m WHERE m.id = p_movimiento;
$$;

CREATE OR REPLACE FUNCTION pg_temp.audit40_estado(p_cuenta uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'movimientos', (SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.id), '[]'::jsonb)
                   FROM public.bbva_movimientos m WHERE m.cuenta_bancaria_id = p_cuenta),
    'bitacora', (SELECT count(*) FROM public.bitacora_actividad b
                WHERE b.accion = 'absorber_espejo_cobro_importacion'
                  AND b.detalles->>'cuenta_bancaria_id' = p_cuenta::text));
$$;

CREATE OR REPLACE FUNCTION pg_temp.audit40_rechazo(
  p_cuenta uuid, p_filas jsonb, p_codigo text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_antes jsonb := pg_temp.audit40_estado(p_cuenta);
  v_error text;
  v_rechazado boolean := false;
BEGIN
  BEGIN
    PERFORM public.absorber_espejos_importacion(p_cuenta, p_filas);
  EXCEPTION WHEN check_violation OR invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    v_rechazado := true;
    PERFORM pg_temp.assert(v_error LIKE p_codigo || '%', 'AUD40: error inesperado ' || v_error);
  END;
  PERFORM pg_temp.assert(v_rechazado, 'AUD40: se admitió una revisión inconsistente');
  PERFORM pg_temp.assert(pg_temp.audit40_estado(p_cuenta) IS NOT DISTINCT FROM v_antes,
    'AUD40: lote rechazado cambió movimientos o bitácora');
END;
$$;
