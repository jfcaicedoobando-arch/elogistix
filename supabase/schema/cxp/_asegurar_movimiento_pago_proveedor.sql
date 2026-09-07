-- Fuente canónica. Espejo 1:1 de la migración 20260907013703 (fix Sentry
-- JAVASCRIPT-REACT-65/66: ON CONFLICT alineado al índice parcial vivo).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public._asegurar_movimiento_pago_proveedor(p_pago_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
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
