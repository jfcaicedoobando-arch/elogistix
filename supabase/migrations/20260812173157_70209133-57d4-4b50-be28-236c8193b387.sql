-- FIX BL-04: exigir tipo de cambio explícito en traspasos cross-moneda.
CREATE OR REPLACE FUNCTION public.registrar_traspaso_bancario(
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_fecha date,
  p_monto_origen numeric,
  p_tipo_cambio numeric DEFAULT NULL,
  p_comision numeric DEFAULT 0,
  p_concepto text DEFAULT '',
  p_referencia text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org uuid := current_user_org_id();
  v_uid uuid := auth.uid();
  v_origen public.cuentas_bancarias%ROWTYPE;
  v_destino public.cuentas_bancarias%ROWTYPE;
  v_tc numeric;
  v_comision numeric := COALESCE(p_comision, 0);
  v_monto_destino numeric;
  v_folio text;
  v_id uuid;
  v_concepto text := COALESCE(NULLIF(TRIM(p_concepto), ''), 'Traspaso entre cuentas propias');
BEGIN
  IF p_cuenta_origen_id = p_cuenta_destino_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_MISMA_CUENTA: la cuenta origen y destino deben ser distintas';
  END IF;
  IF COALESCE(p_monto_origen, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_MONTO_INVALIDO: el monto debe ser mayor a cero';
  END IF;
  IF v_comision < 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_COMISION_INVALIDA: la comisión no puede ser negativa';
  END IF;

  SELECT * INTO v_origen FROM public.cuentas_bancarias WHERE id = p_cuenta_origen_id;
  SELECT * INTO v_destino FROM public.cuentas_bancarias WHERE id = p_cuenta_destino_id;
  IF v_origen.id IS NULL OR v_destino.id IS NULL THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INEXISTENTE: no se encontró alguna de las cuentas';
  END IF;
  IF v_origen.organization_id <> v_destino.organization_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_ORG_DISTINTA: las cuentas pertenecen a organizaciones diferentes';
  END IF;
  IF NOT v_origen.activa OR NOT v_destino.activa THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INACTIVA: ambas cuentas deben estar activas';
  END IF;

  IF v_origen.moneda = v_destino.moneda THEN
    v_tc := 1;
    v_monto_destino := ROUND(p_monto_origen, 2);
  ELSE
    IF p_tipo_cambio IS NULL OR p_tipo_cambio <= 0 THEN
      RAISE EXCEPTION 'LC_TRASPASO_TC_REQUERIDO: captura el tipo de cambio para un traspaso entre monedas distintas';
    END IF;
    v_tc := p_tipo_cambio;
    v_monto_destino := ROUND(p_monto_origen * v_tc, 2);
  END IF;

  SELECT 'TR-' || LPAD((COALESCE(MAX(NULLIF(regexp_replace(folio, '\D', '', 'g'), ''))::bigint, 0) + 1)::text, 6, '0')
    INTO v_folio
    FROM public.traspasos_bancarios
   WHERE organization_id = COALESCE(v_org, v_origen.organization_id);

  INSERT INTO public.traspasos_bancarios(
    organization_id, folio, cuenta_origen_id, cuenta_destino_id, fecha,
    monto_origen, moneda_origen, monto_destino, moneda_destino,
    tipo_cambio, comision, concepto, referencia, created_by
  ) VALUES (
    COALESCE(v_org, v_origen.organization_id), v_folio, p_cuenta_origen_id, p_cuenta_destino_id, p_fecha,
    ROUND(p_monto_origen, 2), v_origen.moneda, v_monto_destino, v_destino.moneda,
    v_tc, ROUND(v_comision, 2), v_concepto, COALESCE(p_referencia, ''), v_uid
  ) RETURNING id INTO v_id;

  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
    v_concepto || ' → ' || v_destino.banco || ' ' || v_destino.alias, COALESCE(p_referencia, ''),
    ROUND(p_monto_origen, 2), 0, 'traspaso-' || v_id::text || '-origen',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );

  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_destino.organization_id), p_cuenta_destino_id, p_fecha,
    v_concepto || ' ← ' || v_origen.banco || ' ' || v_origen.alias, COALESCE(p_referencia, ''),
    0, v_monto_destino, 'traspaso-' || v_id::text || '-destino',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );

  IF ROUND(v_comision, 2) > 0 THEN
    INSERT INTO public.bbva_movimientos(
      organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
      cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
      importado_por, traspaso_id
    ) VALUES (
      COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
      'Comisión bancaria por traspaso ' || v_folio, COALESCE(p_referencia, ''),
      ROUND(v_comision, 2), 0, 'traspaso-' || v_id::text || '-comision',
      'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
    );
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text) TO authenticated, service_role;