-- Fuente canónica de public.registrar_pago_factura_atomico(...).
-- D2 (v13.823.382): cobro individual CxC atómico e idempotente. El cobro y su
-- abono bancario espejo se confirman o se revierten juntos; un reintento con el
-- mismo client_request_id devuelve el cobro existente y repara el movimiento.
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

REVOKE ALL ON FUNCTION public.registrar_pago_factura_atomico(uuid, date, numeric, text, numeric, numeric, text, text, text, numeric, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_pago_factura_atomico(uuid, date, numeric, text, numeric, numeric, text, text, text, numeric, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_factura_atomico(uuid, date, numeric, text, numeric, numeric, text, text, text, numeric, uuid, uuid) TO authenticated, service_role;
