-- Fuente canónica de public.registrar_pago_factura_atomico(...) y su comparador de payload.
-- 1:1 con supabase/migrations/20260917182140_3783eacb-667c-4501-b6f6-b175b44e3bd8.sql.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

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
