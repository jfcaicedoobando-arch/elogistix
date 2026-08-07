CREATE OR REPLACE FUNCTION public.estado_cuenta_bancario(
  p_cuenta_bancaria_id uuid,
  p_desde date,
  p_hasta date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cuenta        record;
  v_saldo_inicial numeric;
  v_movs          jsonb;
  v_entradas      numeric;
  v_salidas       numeric;
BEGIN
  SELECT c.id, c.alias, c.banco, c.moneda, COALESCE(c.saldo_inicial, 0) AS saldo_inicial
    INTO v_cuenta
  FROM cuentas_bancarias c
  WHERE c.id = p_cuenta_bancaria_id
    AND (c.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'));

  IF v_cuenta.id IS NULL THEN
    RAISE EXCEPTION 'LC_CUENTA_NO_ENCONTRADA: la cuenta bancaria no existe o no pertenece a tu organizacion';
  END IF;

  -- Saldo al cierre del dia anterior a p_desde
  SELECT v_cuenta.saldo_inicial
       + COALESCE(SUM(m.abono), 0)
       - COALESCE(SUM(m.cargo), 0)
    INTO v_saldo_inicial
  FROM bbva_movimientos m
  WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
    AND m.deleted_at IS NULL
    AND m.fecha < p_desde;

  WITH movs AS (
    SELECT m.id, m.fecha, m.concepto, m.referencia,
           COALESCE(m.cargo, 0) AS cargo,
           COALESCE(m.abono, 0) AS abono,
           m.estado_conciliacion::text AS estado_conciliacion,
           m.pago_factura_id, m.pago_proveedor_id,
           m.anticipo_proveedor_id, m.pago_proveedor_lote_id,
           v_saldo_inicial + SUM(COALESCE(m.abono, 0) - COALESCE(m.cargo, 0))
             OVER (ORDER BY m.fecha, m.importado_en, m.id
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS saldo_corrido
    FROM bbva_movimientos m
    WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
      AND m.deleted_at IS NULL
      AND m.fecha >= p_desde
      AND m.fecha <= p_hasta
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(movs) ORDER BY movs.fecha, movs.id), '[]'::jsonb),
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
    'saldo_inicial',  COALESCE(v_saldo_inicial, v_cuenta.saldo_inicial),
    'total_entradas', v_entradas,
    'total_salidas',  v_salidas,
    'saldo_final',    COALESCE(v_saldo_inicial, v_cuenta.saldo_inicial) + v_entradas - v_salidas,
    'movimientos',    v_movs
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estado_cuenta_bancario(uuid, date, date) TO authenticated;