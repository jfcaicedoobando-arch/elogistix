-- Fuente canónica. Espejo 1:1 de la migración v13.823.32 (ola de pulido CxP/cotización→embarque/CRM).
-- D4 (v13.823.382): valida la fecha del pago (requerida, no futura y no
-- anterior a la emisión) antes de insertar; el guard la revalida en BD.
-- MNY (20260917180259): el candado de la cuenta bancaria pasa por
-- `_lock_cuenta_bancaria` (SECURITY DEFINER) para que un `contador` pueda
-- registrar pagos; antes el FOR UPDATE directo no veía la fila y la RPC
-- respondía LC_PAGO_CUENTA_INEXISTENTE sobre cuentas existentes y activas.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

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
  -- organización que la factura. El candado se toma vía
  -- `_lock_cuenta_bancaria` (SECURITY DEFINER): con `FOR UPDATE` directo, un
  -- rol de sólo lectura sobre cuentas (contador) no veía la fila y el pago
  -- fallaba con LC_PAGO_CUENTA_INEXISTENTE.
  IF p_cuenta_bancaria_id IS NOT NULL THEN
    SELECT c.org_id, c.esta_activa INTO v_cta_org, v_cta_activa
      FROM public._lock_cuenta_bancaria(p_cuenta_bancaria_id) c;
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
