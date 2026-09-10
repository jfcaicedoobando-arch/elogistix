-- Fuente canónica de public.asegurar_movimiento_cobro_factura (Ola v17).
--
-- PUNTO ÚNICO DE ESCRITURA del movimiento bancario espejo de un cobro de
-- cliente. Antes el abono se insertaba directo desde el navegador con un
-- "consulta y luego inserta" no atómico y el fallo se descartaba en silencio
-- (cobro guardado, saldo del banco sin subir).
--
-- Idempotente por (cuenta_bancaria_id, hash_dedupe) WHERE deleted_at IS NULL.
-- Fail-closed en moneda: sin tipo de cambio no se abona nada.

CREATE OR REPLACE FUNCTION public.asegurar_movimiento_cobro_factura(p_pago_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pago pagos_factura%ROWTYPE;
  v_moneda_cuenta text;
  v_concepto text;
  v_abono numeric;
  v_mov_id uuid;
BEGIN
  SELECT * INTO v_pago FROM public.pagos_factura
   WHERE id = p_pago_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO: el cobro no existe o fue eliminado'
      USING ERRCODE = '22023';
  END IF;

  PERFORM public._assert_writer(v_pago.organization_id);

  IF v_pago.cuenta_bancaria_id IS NULL THEN
    RETURN jsonb_build_object('creado', false, 'motivo', 'sin_cuenta_bancaria');
  END IF;

  IF public.pago_rep_anulado(v_pago.estado_rep) THEN
    RETURN jsonb_build_object('creado', false, 'motivo', 'pago_anulado');
  END IF;

  SELECT id INTO v_mov_id FROM public.bbva_movimientos
   WHERE deleted_at IS NULL
     AND (pago_factura_id = p_pago_id OR hash_dedupe = 'cobro-' || p_pago_id::text)
   LIMIT 1;
  IF v_mov_id IS NOT NULL THEN
    RETURN jsonb_build_object('creado', false, 'motivo', 'ya_existe', 'movimiento_id', v_mov_id);
  END IF;

  SELECT cb.moneda::text INTO v_moneda_cuenta
    FROM public.cuentas_bancarias cb
   WHERE cb.id = v_pago.cuenta_bancaria_id
     AND cb.organization_id = v_pago.organization_id;
  IF v_moneda_cuenta IS NULL THEN
    RAISE EXCEPTION 'LC_CUENTA_NO_ENCONTRADA: la cuenta bancaria del cobro no existe en esta organización'
      USING ERRCODE = '22023';
  END IF;

  IF v_moneda_cuenta <> v_pago.moneda::text AND COALESCE(v_pago.tipo_cambio, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: captura el tipo de cambio del cobro para abonarlo en una cuenta en %', v_moneda_cuenta
      USING ERRCODE = '22023';
  END IF;

  v_abono := CASE
    WHEN v_moneda_cuenta = v_pago.moneda::text THEN v_pago.monto
    WHEN v_pago.moneda::text <> 'MXN' AND v_moneda_cuenta = 'MXN' THEN v_pago.monto * v_pago.tipo_cambio
    WHEN v_pago.moneda::text = 'MXN' AND v_moneda_cuenta <> 'MXN' THEN v_pago.monto / v_pago.tipo_cambio
    ELSE v_pago.monto
  END;

  SELECT 'Cobro factura ' || COALESCE(f.numero, 's/folio') || ' — ' || COALESCE(f.cliente_nombre, 'cliente')
    INTO v_concepto
    FROM public.facturas f WHERE f.id = v_pago.factura_id;

  INSERT INTO public.bbva_movimientos (
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, pago_factura_id,
    conciliado_por, conciliado_at, importado_por
  ) VALUES (
    v_pago.organization_id, v_pago.cuenta_bancaria_id, v_pago.fecha_pago,
    COALESCE(v_concepto, 'Cobro de factura'), COALESCE(v_pago.referencia, ''),
    0, v_abono, 'cobro-' || p_pago_id::text, 'Conciliado', p_pago_id,
    auth.uid(), now(), auth.uid()
  )
  ON CONFLICT (cuenta_bancaria_id, hash_dedupe) WHERE deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_mov_id;

  IF v_mov_id IS NULL THEN
    SELECT id INTO v_mov_id FROM public.bbva_movimientos
     WHERE cuenta_bancaria_id = v_pago.cuenta_bancaria_id
       AND hash_dedupe = 'cobro-' || p_pago_id::text
       AND deleted_at IS NULL
     LIMIT 1;
    RETURN jsonb_build_object('creado', false, 'motivo', 'ya_existe', 'movimiento_id', v_mov_id);
  END IF;

  PERFORM public.registrar_bitacora(
    'tesoreria', 'crear_movimiento_bancario_cobro', v_mov_id,
    COALESCE(v_concepto, ''),
    jsonb_build_object('pago_factura_id', p_pago_id, 'abono', v_abono,
                       'cuenta_bancaria_id', v_pago.cuenta_bancaria_id),
    v_pago.organization_id, auth.uid()
  );

  RETURN jsonb_build_object('creado', true, 'movimiento_id', v_mov_id, 'abono', v_abono);
END;
$function$;

REVOKE ALL ON FUNCTION public.asegurar_movimiento_cobro_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asegurar_movimiento_cobro_factura(uuid) TO authenticated, service_role;
