-- AUD109/111: anticipos históricos sin crédito ficticio y cartera en MXN/USD/EUR.
-- No modifica datos, alcance de organización/portal ni privilegios existentes.
CREATE OR REPLACE FUNCTION public.estado_cuenta_agregados(p_cliente_ids uuid[], p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_result jsonb;
  v_org uuid := public.org_scope();
  v_es_cliente boolean;
BEGIN
  -- M-9 (v14): los usuarios con rol cliente no son miembros de organización
  -- (org_scope() = NULL) y los KPIs salían en $0. El alcance se deriva de los
  -- clientes ligados al usuario.
  IF v_org IS NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = auth.uid()) INTO v_es_cliente;
    IF NOT v_es_cliente THEN
      RAISE EXCEPTION 'LC_ESTADO_CUENTA_SIN_ACCESO: sin organización activa ni cliente ligado';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(COALESCE(p_cliente_ids, ARRAY[]::uuid[])) AS x(id)
      WHERE x.id NOT IN (SELECT public.current_user_client_ids())
    ) THEN
      RAISE EXCEPTION 'LC_ESTADO_CUENTA_SIN_ACCESO: cliente fuera de tu alcance';
    END IF;
  END IF;
  WITH cartera AS (
    SELECT
      f.id,
      f.moneda::text AS moneda,
      -- Canon de saldo: también reabre facturas Pagada cuyo REP fue cancelado
      -- y convierte NC con las tasas históricas del documento.
      GREATEST(0, public._saldo_factura_calc(f.id)) AS saldo,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento) AS dias_vencido
    FROM facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.cliente_id = ANY(p_cliente_ids)
      AND (v_org IS NULL OR f.organization_id = v_org)
      AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
      AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  ),
  anticipos AS (
    SELECT
      f.moneda::text AS moneda,
      GREATEST(0,
        CASE
          -- Sólo históricos verificables pueden producir un saldo disponible.
          WHEN pf.monto IS NULL OR pf.monto <= 0
            OR pf.monto::text IN ('NaN', 'Infinity', '-Infinity')
            OR pf.monto_aplicado_factura IS NULL OR pf.monto_aplicado_factura < 0
            OR pf.monto_aplicado_factura::text IN ('NaN', 'Infinity', '-Infinity') THEN NULL
          WHEN pf.moneda = f.moneda THEN pf.monto
          WHEN pf.moneda IN ('MXN', 'USD') AND f.moneda IN ('MXN', 'USD')
            AND pf.tipo_cambio > 1
            AND pf.tipo_cambio::text NOT IN ('NaN', 'Infinity', '-Infinity')
          THEN public.convertir_monto_pago_a_factura(
            pf.monto, pf.moneda, pf.tipo_cambio, f.moneda, f.tipo_cambio)
          WHEN (pf.moneda = 'EUR' OR f.moneda = 'EUR')
            AND (pf.moneda = 'MXN' OR (pf.tipo_cambio > 1
              AND pf.tipo_cambio::text NOT IN ('NaN', 'Infinity', '-Infinity')))
            AND (f.moneda = 'MXN' OR (f.tipo_cambio > 1
              AND f.tipo_cambio::text NOT IN ('NaN', 'Infinity', '-Infinity')))
          THEN public.convertir_monto_pago_a_factura(
            pf.monto, pf.moneda, pf.tipo_cambio, f.moneda, f.tipo_cambio)
          ELSE NULL
        END - pf.monto_aplicado_factura
      ) AS no_aplicado
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND NOT public.pago_rep_anulado(pf.estado_rep)
      AND f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.cliente_id = ANY(p_cliente_ids)
      AND (v_org IS NULL OR f.organization_id = v_org)
      AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
      AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  )
  SELECT jsonb_build_object(
    'adeudado_mxn',      COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'MXN' AND saldo > 0), 0),
    'adeudado_usd',      COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'USD' AND saldo > 0), 0),
    'adeudado_eur',      COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'EUR' AND saldo > 0), 0),
    'vencido_mxn',       COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'MXN' AND saldo > 0 AND dias_vencido > 0), 0),
    'vencido_usd',       COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'USD' AND saldo > 0 AND dias_vencido > 0), 0),
    'vencido_eur',       COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'EUR' AND saldo > 0 AND dias_vencido > 0), 0),
    'a_favor_mxn',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'MXN'), 0),
    'a_favor_usd',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'USD'), 0),
    'a_favor_eur',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'EUR'), 0),
    'facturas_vencidas', (SELECT COUNT(*) FROM cartera WHERE saldo > 0 AND dias_vencido > 0),
    'facturas_adeudadas',(SELECT COUNT(*) FROM cartera WHERE saldo > 0)
  ) INTO v_result;
  RETURN v_result;
END;
$_$;
REVOKE ALL ON FUNCTION public.estado_cuenta_agregados(uuid[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estado_cuenta_agregados(uuid[], date, date) TO authenticated, service_role;
