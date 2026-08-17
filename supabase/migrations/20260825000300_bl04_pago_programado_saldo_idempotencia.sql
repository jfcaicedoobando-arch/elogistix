-- ============================================================
-- BL-04 · ejecutar_pago_programado: saldo de cuenta mal calculado + sin
-- idempotencia.
--
-- Causa raíz (migración 20260729215846, única definición vigente): el saldo
-- se calculaba sumando TODOS los bbva_movimientos de la cuenta —
--   (1) incluía movimientos con deleted_at (borrados siguen sumando), y
--   (2) incluía movimientos ANTERIORES a cuentas_bancarias.fecha_saldo_inicial,
--       que el saldo_inicial ya incorpora → doble conteo.
-- El gate LC_CUENTA_SALDO_INSUFICIENTE operaba sobre ese saldo incorrecto
-- (bloquea pagos válidos o permite sobregiros reales) y el `saldo`
-- persistido en el movimiento heredaba el error. Además la RPC no tenía
-- request_id ni dedupe: un doble submit ejecutaba el pago dos veces.
--
-- Fix:
--   1) Nueva función compartida public.saldo_cuenta_bancaria(uuid) con el
--      canon de estado_cuenta_bancario (20260814161725: `deleted_at IS NULL
--      AND fecha >= fecha_saldo_inicial`). STABLE, SECURITY DEFINER,
--      search_path fijado; ejecutar_pago_programado la usa.
--   2) p_request_id uuid DEFAULT NULL + idempotency_claim/store (patrón
--      avanzar_estado_embarque): reintento con la misma llave devuelve la
--      respuesta almacenada; ejecución en vuelo → LC_PAGO_PROGRAMADO_EN_PROCESO.
--
-- CAMBIO DE FIRMA: se dropea la firma anterior (uuid,uuid,date,numeric,text,
-- text) — precedente: 20260808011825 (DROP + CREATE con DEFAULT). Los
-- callers por nombre (p_factura_id => ...) no se afectan; p_request_id es
-- opcional. Mismo body salvo el cálculo de saldo y la idempotencia; mismos
-- grants.
-- ============================================================

CREATE OR REPLACE FUNCTION public.saldo_cuenta_bancaria(p_cuenta_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_saldo numeric;
BEGIN
  -- Canon de estado_cuenta_bancario: saldo_inicial corresponde a
  -- fecha_saldo_inicial; los movimientos previos a ese corte NO se suman
  -- (ya están dentro del saldo inicial) y los borrados nunca cuentan.
  SELECT COALESCE(cb.saldo_inicial, 0)
       + COALESCE(SUM(COALESCE(m.abono, 0) - COALESCE(m.cargo, 0)), 0)
    INTO v_saldo
  FROM public.cuentas_bancarias cb
  LEFT JOIN public.bbva_movimientos m
    ON m.cuenta_bancaria_id = cb.id
   AND m.deleted_at IS NULL
   AND m.fecha >= cb.fecha_saldo_inicial
  WHERE cb.id = p_cuenta_id
  GROUP BY cb.id, cb.saldo_inicial;

  RETURN v_saldo;  -- NULL si la cuenta no existe: el caller valida.
END;
$function$;

REVOKE ALL ON FUNCTION public.saldo_cuenta_bancaria(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_cuenta_bancaria(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saldo_cuenta_bancaria(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.ejecutar_pago_programado(uuid, uuid, date, numeric, text, text);

CREATE OR REPLACE FUNCTION public.ejecutar_pago_programado(
  p_factura_id uuid,
  p_cuenta_bancaria_id uuid,
  p_fecha date,
  p_monto numeric,
  p_metodo_pago text DEFAULT 'Transferencia',
  p_referencia text DEFAULT '',
  p_request_id uuid DEFAULT NULL
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
  v_resp jsonb;
  v_cached jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- BL-04: reclamo atómico de la llave de idempotencia. Reintento del mismo
  -- submit → respuesta almacenada; ejecución aún en vuelo → rechazo claro.
  v_cached := public.idempotency_claim(p_request_id, 'ejecutar_pago_programado');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_PAGO_PROGRAMADO_EN_PROCESO: Este pago programado ya está en proceso; espera unos segundos y verifica antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    RETURN v_cached;
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

  -- BL-04: cálculo alineado al canon de estado_cuenta_bancario (antes sumaba
  -- movimientos borrados y anteriores al corte del saldo inicial → doble
  -- conteo). La cuenta ya está bloqueada FOR UPDATE.
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

  -- BL-04: almacena la respuesta para los reintentos con la misma llave
  -- (no-op cuando p_request_id viene NULL).
  PERFORM public.idempotency_store(p_request_id, v_resp);

  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.ejecutar_pago_programado(uuid, uuid, date, numeric, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ejecutar_pago_programado(uuid, uuid, date, numeric, text, text, uuid) TO authenticated;
