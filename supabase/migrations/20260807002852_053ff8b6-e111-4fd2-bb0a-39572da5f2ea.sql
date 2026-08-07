CREATE OR REPLACE FUNCTION public.estado_cuenta_bancario(p_cuenta_bancaria_id uuid, p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cuenta      record;
  v_saldo_ini   numeric := 0;
  v_entradas    numeric := 0;
  v_salidas     numeric := 0;
  v_movs        jsonb   := '[]'::jsonb;
BEGIN
  IF p_cuenta_bancaria_id IS NULL OR p_desde IS NULL OR p_hasta IS NULL THEN
    RAISE EXCEPTION 'LC_ESTADO_CUENTA_PARAMS: cuenta y periodo son obligatorios';
  END IF;
  IF p_hasta < p_desde THEN
    RAISE EXCEPTION 'LC_ESTADO_CUENTA_RANGO: la fecha final no puede ser anterior a la inicial';
  END IF;

  SELECT cb.id, cb.alias, cb.banco, cb.moneda, COALESCE(cb.saldo_inicial, 0) AS saldo_apertura
    INTO v_cuenta
  FROM public.cuentas_bancarias cb
  WHERE cb.id = p_cuenta_bancaria_id
    AND (cb.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'));

  IF v_cuenta.id IS NULL THEN
    RAISE EXCEPTION 'LC_ESTADO_CUENTA_SIN_ACCESO: la cuenta no existe o no pertenece a tu organización';
  END IF;

  -- Saldo inicial del periodo = saldo de apertura de la cuenta + neto anterior al periodo
  SELECT v_cuenta.saldo_apertura + COALESCE(SUM(m.abono - m.cargo), 0)
    INTO v_saldo_ini
  FROM public.bbva_movimientos m
  WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
    AND m.deleted_at IS NULL
    AND m.fecha < p_desde;

  WITH movs AS (
    SELECT
      m.id, m.fecha, m.concepto, m.referencia,
      COALESCE(m.cargo, 0) AS cargo,
      COALESCE(m.abono, 0) AS abono,
      m.estado_conciliacion::text AS estado_conciliacion,
      m.pago_factura_id, m.pago_proveedor_id,
      m.anticipo_proveedor_id, m.pago_proveedor_lote_id,
      v_saldo_ini + SUM(COALESCE(m.abono, 0) - COALESCE(m.cargo, 0))
        OVER (ORDER BY m.fecha, m.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS saldo_corrido
    FROM public.bbva_movimientos m
    WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
      AND m.deleted_at IS NULL
      AND m.fecha >= p_desde
      AND m.fecha <= p_hasta
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(movs) ORDER BY movs.fecha, movs.id), '[]'::jsonb),
    COALESCE(SUM(movs.abono), 0),
    COALESCE(SUM(movs.cargo), 0)
  INTO v_movs, v_entradas, v_salidas
  FROM movs;

  RETURN jsonb_build_object(
    'cuenta_id',      v_cuenta.id,
    'alias',          v_cuenta.alias,
    'banco',          v_cuenta.banco,
    'moneda',         v_cuenta.moneda,
    'desde',          p_desde,
    'hasta',          p_hasta,
    'saldo_inicial',  v_saldo_ini,
    'total_entradas', v_entradas,
    'total_salidas',  v_salidas,
    'saldo_final',    v_saldo_ini + v_entradas - v_salidas,
    'movimientos',    v_movs
  );
END;
$fn$;

-- H6: la función es SECURITY DEFINER → no ejecutable por PUBLIC.
REVOKE ALL ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) TO authenticated, service_role;
