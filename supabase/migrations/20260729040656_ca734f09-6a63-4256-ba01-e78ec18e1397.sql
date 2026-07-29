-- ============================================================================
-- FIX C3c (S6-01..S6-05) · Agregados de dinero server-side.
--
-- Las pantallas de dinero calculaban SUM/KPIs en JS sobre filas traídas al
-- navegador; PostgREST trunca a max-rows y las cifras salían mal en silencio.
-- Estas RPCs agregan en Postgres (SUM/GROUP BY) y devuelven JSON compacto.
--
-- Convenciones (obligatorias en este repo):
--   * STABLE SECURITY DEFINER + SET search_path = public.
--   * Guard de tenant: organization_id = current_user_org_id() OR super_admin.
--   * deleted_at IS NULL en TODAS las tablas (coherente con FIX C5).
--   * Política de conversión (canon FIX C6): moneda extranjera sin TC
--     confiable (tipo_cambio > 1) NO se suma; fallback solo explícito.
--   * REVOKE de PUBLIC/anon + GRANT a authenticated.
--   * Fechas 'hoy' ancladas a CDMX (convención hoyMx del repo).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cobranza_agregados(
  p_cliente_id uuid DEFAULT NULL,
  p_moneda text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH cartera AS (
    SELECT
      f.moneda::text AS moneda,
      GREATEST(0, f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0)) AS saldo,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento) AS dias_vencido
    FROM facturas f
    LEFT JOIN LATERAL (
      SELECT SUM(pf.monto_aplicado_factura) AS pagado
      FROM pagos_factura pf
      WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
    ) pg ON true
    LEFT JOIN LATERAL (
      SELECT SUM(n.monto) AS notas
      FROM factura_notas_credito n
      WHERE n.factura_id = f.id AND n.deleted_at IS NULL AND n.estado = 'Aplicada'
    ) nc ON true
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
      AND (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
      AND (p_cliente_id IS NULL OR f.cliente_id = p_cliente_id)
      AND (p_moneda IS NULL OR f.moneda::text = p_moneda)
  )
  SELECT jsonb_build_object(
    'total_mxn',          COALESCE(SUM(saldo) FILTER (WHERE moneda = 'MXN' AND saldo > 0), 0),
    'total_usd',          COALESCE(SUM(saldo) FILTER (WHERE moneda = 'USD' AND saldo > 0), 0),
    'vencido_mxn',        COALESCE(SUM(saldo) FILTER (WHERE moneda = 'MXN' AND saldo > 0 AND dias_vencido > 0), 0),
    'vencido_usd',        COALESCE(SUM(saldo) FILTER (WHERE moneda = 'USD' AND saldo > 0 AND dias_vencido > 0), 0),
    'por_vencer_7d_mxn',  COALESCE(SUM(saldo) FILTER (WHERE moneda = 'MXN' AND saldo > 0 AND dias_vencido BETWEEN -7 AND 0), 0),
    'por_vencer_7d_usd',  COALESCE(SUM(saldo) FILTER (WHERE moneda = 'USD' AND saldo > 0 AND dias_vencido BETWEEN -7 AND 0), 0),
    'facturas_vencidas',  COUNT(*) FILTER (WHERE moneda IN ('MXN','USD') AND saldo > 0 AND dias_vencido > 0),
    'facturas_con_saldo', COUNT(*) FILTER (WHERE saldo > 0)
  ) INTO v_result
  FROM cartera;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.cobranza_agregados(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranza_agregados(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.estado_cuenta_agregados(
  p_cliente_ids uuid[],
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH cartera AS (
    SELECT
      f.id,
      f.moneda::text AS moneda,
      GREATEST(0, f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0)) AS saldo,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento) AS dias_vencido
    FROM facturas f
    LEFT JOIN LATERAL (
      SELECT SUM(pf.monto_aplicado_factura) AS pagado
      FROM pagos_factura pf
      WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
    ) pg ON true
    LEFT JOIN LATERAL (
      SELECT SUM(n.monto) AS notas
      FROM factura_notas_credito n
      WHERE n.factura_id = f.id AND n.deleted_at IS NULL AND n.estado = 'Aplicada'
    ) nc ON true
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.cliente_id = ANY(p_cliente_ids)
      AND (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
      AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
      AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  ),
  anticipos AS (
    SELECT
      f.moneda::text AS moneda,
      GREATEST(0,
        pf.monto * CASE
          WHEN pf.moneda = f.moneda THEN 1
          WHEN pf.tipo_cambio IS NOT NULL AND pf.tipo_cambio > 0 THEN pf.tipo_cambio
          ELSE 0
        END - pf.monto_aplicado_factura
      ) AS no_aplicado
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND f.cliente_id = ANY(p_cliente_ids)
      AND (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
      AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
      AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  )
  SELECT jsonb_build_object(
    'adeudado_mxn',      COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'MXN' AND saldo > 0), 0),
    'adeudado_usd',      COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'USD' AND saldo > 0), 0),
    'vencido_mxn',       COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'MXN' AND saldo > 0 AND dias_vencido > 0), 0),
    'vencido_usd',       COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'USD' AND saldo > 0 AND dias_vencido > 0), 0),
    'a_favor_mxn',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'MXN'), 0),
    'a_favor_usd',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'USD'), 0),
    'facturas_vencidas', (SELECT COUNT(*) FROM cartera WHERE saldo > 0 AND dias_vencido > 0),
    'facturas_adeudadas',(SELECT COUNT(*) FROM cartera WHERE saldo > 0)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.estado_cuenta_agregados(uuid[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estado_cuenta_agregados(uuid[], date, date) TO authenticated;

-- bbva_movimientos NO tiene deleted_at (deuda M6): la ausencia de filtro es
-- deliberada, no un olvido.
CREATE OR REPLACE FUNCTION public.conciliacion_resumen(
  p_cuenta_bancaria_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_movimientos',  COUNT(*),
    'pendientes',         COUNT(*) FILTER (WHERE estado_conciliacion = 'Pendiente'),
    'conciliados',        COUNT(*) FILTER (WHERE estado_conciliacion = 'Conciliado'),
    'ignorados',          COUNT(*) FILTER (WHERE estado_conciliacion = 'Ignorado'),
    'cargos_pendientes',  COALESCE(SUM(cargo) FILTER (WHERE estado_conciliacion = 'Pendiente'), 0),
    'abonos_pendientes',  COALESCE(SUM(abono) FILTER (WHERE estado_conciliacion = 'Pendiente'), 0)
  ) INTO v_result
  FROM bbva_movimientos
  WHERE cuenta_bancaria_id = p_cuenta_bancaria_id
    AND (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliacion_resumen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conciliacion_resumen(uuid) TO authenticated;

-- El cobrado se convierte con la moneda de la FACTURA (join), porque
-- monto_aplicado_factura está en moneda de la factura (convención B-077).
CREATE OR REPLACE FUNCTION public.dashboard_facturacion_kpis(
  p_meses int DEFAULT 6,
  p_fallback_usd numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_desde date := (date_trunc('month', v_hoy) - make_interval(months => GREATEST(p_meses, 1) - 1))::date;
  v_result jsonb;
BEGIN
  WITH meses AS (
    SELECT generate_series(v_desde, date_trunc('month', v_hoy)::date, '1 month'::interval)::date AS inicio
  ),
  fact AS (
    SELECT
      date_trunc('month', f.fecha_emision)::date AS mes,
      CASE
        WHEN f.moneda = 'MXN' THEN f.total
        WHEN f.tipo_cambio IS NOT NULL AND f.tipo_cambio > 1 THEN f.total * f.tipo_cambio
        WHEN f.moneda = 'USD' AND p_fallback_usd IS NOT NULL AND p_fallback_usd > 0 THEN f.total * p_fallback_usd
        ELSE NULL
      END AS total_mxn,
      (
        f.moneda <> 'MXN'
        AND NOT (f.tipo_cambio IS NOT NULL AND f.tipo_cambio > 1)
        AND NOT (f.moneda = 'USD' AND p_fallback_usd IS NOT NULL AND p_fallback_usd > 0)
      ) AS sin_tc
    FROM facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.fecha_emision >= v_desde
      AND (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
  ),
  fact_mes AS (
    SELECT mes, SUM(total_mxn) AS facturado_mxn FROM fact WHERE total_mxn IS NOT NULL GROUP BY mes
  ),
  pagos AS (
    SELECT
      date_trunc('month', pf.fecha_pago)::date AS mes,
      CASE
        WHEN f.moneda = 'MXN' THEN pf.monto_aplicado_factura
        WHEN f.tipo_cambio IS NOT NULL AND f.tipo_cambio > 1 THEN pf.monto_aplicado_factura * f.tipo_cambio
        WHEN f.moneda = 'USD' AND p_fallback_usd IS NOT NULL AND p_fallback_usd > 0 THEN pf.monto_aplicado_factura * p_fallback_usd
        ELSE NULL
      END AS cobrado_mxn
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND pf.fecha_pago >= v_desde
      AND (pf.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
  ),
  pagos_mes AS (
    SELECT mes, SUM(cobrado_mxn) AS cobrado_mxn FROM pagos WHERE cobrado_mxn IS NOT NULL GROUP BY mes
  )
  SELECT jsonb_build_object(
    'tendencia', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'mes', to_char(m.inicio, 'YYYY-MM'),
        'facturado_mxn', COALESCE(fm.facturado_mxn, 0),
        'cobrado_mxn', COALESCE(pm.cobrado_mxn, 0)
      ) ORDER BY m.inicio)
      FROM meses m
      LEFT JOIN fact_mes fm ON fm.mes = m.inicio
      LEFT JOIN pagos_mes pm ON pm.mes = m.inicio
    ), '[]'::jsonb),
    'facturas_sin_tc', COALESCE((
      SELECT COUNT(*) FROM fact
      WHERE sin_tc AND mes = date_trunc('month', v_hoy)::date
    ), 0)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_facturacion_kpis(int, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_facturacion_kpis(int, numeric) TO authenticated;

-- Agrupado por moneda SIN mezclar divisas: la conversión a MXN equivalente la
-- hace el cliente con el canon (FIX C6).
CREATE OR REPLACE FUNCTION public.direccion_totales(
  p_desde date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH emb AS (
    SELECT e.id
    FROM embarques e
    WHERE e.deleted_at IS NULL
      AND (e.cerrado_at >= p_desde OR e.eta >= p_desde)
      AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
  ),
  ventas AS (
    SELECT cv.moneda::text AS moneda, SUM(cv.total) AS total
    FROM conceptos_venta cv
    WHERE cv.deleted_at IS NULL AND cv.embarque_id IN (SELECT id FROM emb)
    GROUP BY cv.moneda
  ),
  costos AS (
    SELECT cc.moneda::text AS moneda, SUM(cc.monto) AS total
    FROM conceptos_costo cc
    WHERE cc.deleted_at IS NULL AND cc.embarque_id IN (SELECT id FROM emb)
    GROUP BY cc.moneda
  ),
  facturado AS (
    SELECT f.moneda::text AS moneda, SUM(f.total) AS total
    FROM facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.fecha_emision >= p_desde
      AND (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    GROUP BY f.moneda
  ),
  cobrado AS (
    SELECT f.moneda::text AS moneda, SUM(pf.monto_aplicado_factura) AS total
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND pf.fecha_pago >= p_desde
      AND (pf.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    GROUP BY f.moneda
  )
  SELECT jsonb_build_object(
    'embarques',  (SELECT COUNT(*) FROM emb),
    'ventas',     COALESCE((SELECT jsonb_object_agg(moneda, total) FROM ventas), '{}'::jsonb),
    'costos',     COALESCE((SELECT jsonb_object_agg(moneda, total) FROM costos), '{}'::jsonb),
    'facturado',  COALESCE((SELECT jsonb_object_agg(moneda, total) FROM facturado), '{}'::jsonb),
    'cobrado',    COALESCE((SELECT jsonb_object_agg(moneda, total) FROM cobrado), '{}'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.direccion_totales(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direccion_totales(date) TO authenticated;