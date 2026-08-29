-- Ola 2 · Auditoría v14 (A-2 / M-5): las RPCs de KPIs usaban el guard
-- (organization_id = current_user_org_id() OR has_role(auth.uid(),'super_admin')),
-- que ignora el tenant impersonado por un super_admin y termina sumando
-- TODAS las organizaciones en vez de sólo la organización activa/impersonada.
-- Corrección: reemplazar ese guard (y, en eerr_resumen_anual, el uso directo
-- de current_user_org_id()) por public.org_scope(), que sí respeta la
-- impersonación de tenant. Las firmas de las funciones NO cambian.
--
-- Funciones corregidas: cobranza_agregados, dashboard_facturacion_kpis,
-- direccion_totales, eerr_resumen_anual, busqueda_global, sidebar_alert_counts.

-- ============================================================
-- cobranza_agregados
-- ============================================================
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
      AND f.organization_id = public.org_scope()
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

-- ============================================================
-- dashboard_facturacion_kpis
-- ============================================================
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
      AND f.organization_id = public.org_scope()
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
      AND pf.organization_id = public.org_scope()
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

-- ============================================================
-- direccion_totales
-- ============================================================
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
      -- Ola 5 · N23: excluir Cancelado, alineado con el loader cliente
      -- del dashboard de Dirección.
      AND e.estado <> 'Cancelado'
      AND (e.cerrado_at >= p_desde OR e.eta >= p_desde)
      AND e.organization_id = public.org_scope()
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
      AND f.organization_id = public.org_scope()
    GROUP BY f.moneda
  ),
  cobrado AS (
    SELECT f.moneda::text AS moneda, SUM(pf.monto_aplicado_factura) AS total
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND pf.fecha_pago >= p_desde
      AND pf.organization_id = public.org_scope()
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

-- ============================================================
-- eerr_resumen_anual
-- ============================================================
CREATE OR REPLACE FUNCTION public.eerr_resumen_anual(p_year integer, p_fuente text DEFAULT 'embarques'::text)
 RETURNS TABLE(mes integer, ingresos_mxn numeric, costos_mxn numeric, excluidos_sin_tc integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.org_scope();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: usuario sin organizacion activa' USING ERRCODE='42501';
  END IF;

  IF p_fuente = 'embarques' THEN
    RETURN QUERY
    WITH meses AS (
      SELECT generate_series(1,12) AS mes
    ),
    emb AS (
      SELECT
        e.id,
        EXTRACT(month FROM e.eta)::int AS mes,
        (SELECT t.tc FROM public.tc_para_documento(e.eta, 'USD', e.tipo_cambio_usd, NULL) t) AS tc_usd,
        (SELECT t.tc FROM public.tc_para_documento(e.eta, 'EUR', e.tipo_cambio_eur, NULL) t) AS tc_eur
      FROM public.embarques e
      WHERE e.deleted_at IS NULL
        AND e.organization_id = v_org
        AND e.estado <> 'Cancelado'
        AND e.eta IS NOT NULL
        AND EXTRACT(year FROM e.eta) = p_year
    ),
    ing AS (
      SELECT em.mes,
        SUM(
          CASE UPPER(COALESCE(cv.moneda::text, 'MXN'))
            WHEN 'USD' THEN CASE WHEN em.tc_usd IS NOT NULL THEN COALESCE(cv.total, 0) * em.tc_usd END
            WHEN 'EUR' THEN CASE WHEN em.tc_eur IS NOT NULL THEN COALESCE(cv.total, 0) * em.tc_eur END
            ELSE COALESCE(cv.total, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(cv.moneda::text, 'MXN')) = 'USD' AND em.tc_usd IS NULL)
             OR (UPPER(COALESCE(cv.moneda::text, 'MXN')) = 'EUR' AND em.tc_eur IS NULL)
        ) AS sin_tc
      FROM public.conceptos_venta cv
      JOIN emb em ON em.id = cv.embarque_id
      WHERE cv.deleted_at IS NULL
      GROUP BY em.mes
    ),
    cst AS (
      SELECT em.mes,
        SUM(
          CASE UPPER(COALESCE(cc.moneda::text, 'MXN'))
            WHEN 'USD' THEN CASE WHEN em.tc_usd IS NOT NULL THEN COALESCE(cc.monto, 0) * em.tc_usd END
            WHEN 'EUR' THEN CASE WHEN em.tc_eur IS NOT NULL THEN COALESCE(cc.monto, 0) * em.tc_eur END
            ELSE COALESCE(cc.monto, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(cc.moneda::text, 'MXN')) = 'USD' AND em.tc_usd IS NULL)
             OR (UPPER(COALESCE(cc.moneda::text, 'MXN')) = 'EUR' AND em.tc_eur IS NULL)
        ) AS sin_tc
      FROM public.conceptos_costo cc
      JOIN emb em ON em.id = cc.embarque_id
      WHERE cc.deleted_at IS NULL
      GROUP BY em.mes
    )
    SELECT m.mes,
           COALESCE(i.total, 0)::numeric AS ingresos_mxn,
           COALESCE(c.total, 0)::numeric AS costos_mxn,
           (COALESCE(i.sin_tc, 0) + COALESCE(c.sin_tc, 0))::integer AS excluidos_sin_tc
    FROM meses m
    LEFT JOIN ing i ON i.mes = m.mes
    LEFT JOIN cst c ON c.mes = m.mes
    ORDER BY m.mes;

  ELSIF p_fuente = 'facturas' THEN
    RETURN QUERY
    WITH meses AS (
      SELECT generate_series(1,12) AS mes
    ),
    fact_src AS (
      SELECT
        f.fecha_emision, f.moneda::text AS moneda, f.total,
        (SELECT t.tc FROM public.tc_para_documento(f.fecha_emision, 'USD', f.tipo_cambio, e.tipo_cambio_usd) t) AS tc_usd,
        (SELECT t.tc FROM public.tc_para_documento(f.fecha_emision, 'EUR', f.tipo_cambio, e.tipo_cambio_eur) t) AS tc_eur
      FROM public.facturas f
      LEFT JOIN public.embarques e ON e.expediente = f.expediente
                                    AND e.organization_id = v_org
                                    AND e.deleted_at IS NULL
      WHERE f.deleted_at IS NULL
        AND f.organization_id = v_org
        AND f.estado IN ('Emitida', 'Pagada', 'Vencida', 'Parcialmente pagada')
        AND f.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM f.fecha_emision) = p_year
    ),
    fact AS (
      SELECT
        EXTRACT(month FROM fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(moneda, 'MXN'))
            WHEN 'USD' THEN CASE WHEN tc_usd IS NOT NULL THEN COALESCE(total, 0) * tc_usd END
            WHEN 'EUR' THEN CASE WHEN tc_eur IS NOT NULL THEN COALESCE(total, 0) * tc_eur END
            ELSE COALESCE(total, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(moneda, 'MXN')) = 'USD' AND tc_usd IS NULL)
             OR (UPPER(COALESCE(moneda, 'MXN')) = 'EUR' AND tc_eur IS NULL)
        ) AS sin_tc
      FROM fact_src
      GROUP BY EXTRACT(month FROM fecha_emision)
    ),
    ncs AS (
      SELECT
        EXTRACT(month FROM ncf.fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(ncf.moneda::text, 'MXN'))
            WHEN 'USD' THEN ABS(COALESCE(ncf.monto, 0)) * (SELECT t.tc FROM public.tc_para_documento(ncf.fecha_emision, 'USD', ncf.tipo_cambio, NULL) t)
            WHEN 'EUR' THEN ABS(COALESCE(ncf.monto, 0)) * (SELECT t.tc FROM public.tc_para_documento(ncf.fecha_emision, 'EUR', ncf.tipo_cambio, NULL) t)
            ELSE ABS(COALESCE(ncf.monto, 0))
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(ncf.moneda::text, 'MXN')) IN ('USD','EUR')
            AND (SELECT t.tc FROM public.tc_para_documento(ncf.fecha_emision, ncf.moneda::text, ncf.tipo_cambio, NULL) t) IS NULL
        ) AS sin_tc
      FROM public.factura_notas_credito ncf
      WHERE ncf.deleted_at IS NULL
        AND ncf.organization_id = v_org
        AND ncf.estado = 'Aplicada'
        AND ncf.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM ncf.fecha_emision) = p_year
        -- Ola 14 · borrado logico estricto: la NC de una factura eliminada no
        -- puede seguir reduciendo el ingreso del mes.
        AND EXISTS (
          SELECT 1 FROM public.facturas f
          WHERE f.id = ncf.factura_id AND f.deleted_at IS NULL
        )
      GROUP BY EXTRACT(month FROM ncf.fecha_emision)
    ),
    pfact_src AS (
      SELECT
        pf.fecha_emision, pf.moneda::text AS moneda, pf.total,
        (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'USD', pf.tipo_cambio_usd, e.tipo_cambio_usd) t) AS tc_usd,
        (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'EUR', NULL, e.tipo_cambio_eur) t) AS tc_eur
      FROM public.proveedor_facturas pf
      LEFT JOIN public.embarques e ON e.id = pf.embarque_id
                                    AND e.organization_id = v_org
                                    AND e.deleted_at IS NULL
      WHERE pf.deleted_at IS NULL
        AND pf.organization_id = v_org
        AND pf.estado <> 'Cancelada'
        AND pf.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM pf.fecha_emision) = p_year
    ),
    pfact AS (
      SELECT
        EXTRACT(month FROM fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(moneda, 'MXN'))
            WHEN 'USD' THEN CASE WHEN tc_usd IS NOT NULL THEN COALESCE(total, 0) * tc_usd END
            WHEN 'EUR' THEN CASE WHEN tc_eur IS NOT NULL THEN COALESCE(total, 0) * tc_eur END
            ELSE COALESCE(total, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(moneda, 'MXN')) = 'USD' AND tc_usd IS NULL)
             OR (UPPER(COALESCE(moneda, 'MXN')) = 'EUR' AND tc_eur IS NULL)
        ) AS sin_tc
      FROM pfact_src
      GROUP BY EXTRACT(month FROM fecha_emision)
    ),
    ncp AS (
      SELECT
        EXTRACT(month FROM n.updated_at)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(n.moneda::text, 'MXN'))
            WHEN 'USD' THEN CASE WHEN tc.tc_usd IS NOT NULL THEN ABS(COALESCE(n.monto, 0)) * tc.tc_usd END
            WHEN 'EUR' THEN CASE WHEN tc.tc_eur IS NOT NULL THEN ABS(COALESCE(n.monto, 0)) * tc.tc_eur END
            ELSE ABS(COALESCE(n.monto, 0))
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(n.moneda::text, 'MXN')) = 'USD' AND tc.tc_usd IS NULL)
             OR (UPPER(COALESCE(n.moneda::text, 'MXN')) = 'EUR' AND tc.tc_eur IS NULL)
        ) AS sin_tc
      FROM public.proveedor_notas_credito n
      -- Ola 14 · borrado logico estricto: si la factura de proveedor fue
      -- eliminada, su NC ya no descuenta el costo del mes.
      JOIN public.proveedor_facturas pf ON pf.id = n.proveedor_factura_id AND pf.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT
          (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'USD', pf.tipo_cambio_usd, e.tipo_cambio_usd) t) AS tc_usd,
          (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'EUR', NULL, e.tipo_cambio_eur) t) AS tc_eur
        FROM public.embarques e
        WHERE e.id = pf.embarque_id AND e.organization_id = v_org AND e.deleted_at IS NULL
      ) tc ON true
      WHERE n.deleted_at IS NULL
        AND n.organization_id = v_org
        AND n.estado = 'Aplicada'
        AND n.updated_at IS NOT NULL
        AND EXTRACT(year FROM n.updated_at) = p_year
      GROUP BY EXTRACT(month FROM n.updated_at)
    )
    SELECT m.mes,
           (COALESCE(f.total, 0) - COALESCE(n.total, 0))::numeric AS ingresos_mxn,
           (COALESCE(p.total, 0) - COALESCE(np.total, 0))::numeric AS costos_mxn,
           (COALESCE(f.sin_tc, 0) + COALESCE(n.sin_tc, 0) + COALESCE(p.sin_tc, 0) + COALESCE(np.sin_tc, 0))::integer AS excluidos_sin_tc
    FROM meses m
    LEFT JOIN fact f ON f.mes = m.mes
    LEFT JOIN ncs  n ON n.mes = m.mes
    LEFT JOIN pfact p ON p.mes = m.mes
    LEFT JOIN ncp np ON np.mes = m.mes
    ORDER BY m.mes;

  ELSE
    RAISE EXCEPTION 'LC_EERR_FUENTE_INVALIDA: fuente=% no reconocida (usa embarques|facturas)', p_fuente USING ERRCODE='22023';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.eerr_resumen_anual(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eerr_resumen_anual(integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.eerr_resumen_anual(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eerr_resumen_anual(integer, text) TO service_role;

-- ============================================================
-- busqueda_global
-- ============================================================
CREATE OR REPLACE FUNCTION public.busqueda_global(termino text, limite integer DEFAULT 5)
 RETURNS TABLE(id uuid, label text, sublabel text, tipo text, url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
   (SELECT DISTINCT ON (e.expediente)
           e.id, e.expediente AS label,
           (e.cliente_nombre
             || CASE
                  WHEN e.bl_master IS NOT NULL AND e.bl_master ILIKE '%' || termino || '%' AND e.expediente NOT ILIKE '%' || termino || '%'
                    THEN ' · BL/M ' || e.bl_master
                  WHEN e.bl_house IS NOT NULL AND e.bl_house ILIKE '%' || termino || '%' AND e.expediente NOT ILIKE '%' || termino || '%'
                    THEN ' · BL/H ' || e.bl_house
                  WHEN COUNT(*) OVER (PARTITION BY e.expediente) > 1
                    THEN ' · ' || COUNT(*) OVER (PARTITION BY e.expediente) || ' contenedores'
                  ELSE ''
                END) AS sublabel,
           'embarque'::text AS tipo,
           '/embarques/' || e.id AS url
    FROM embarques e
    WHERE (e.expediente ILIKE '%' || termino || '%'
           OR e.bl_master ILIKE '%' || termino || '%'
           OR e.bl_house  ILIKE '%' || termino || '%')
      AND e.deleted_at IS NULL
      AND e.organization_id = public.org_scope()
    ORDER BY e.expediente, e.created_at ASC
    LIMIT limite)
   UNION ALL
   (SELECT cl.id, cl.nombre AS label, cl.rfc AS sublabel, 'cliente'::text AS tipo, '/clientes/' || cl.id AS url
    FROM clientes cl WHERE (cl.nombre ILIKE '%' || termino || '%' OR cl.rfc ILIKE '%' || termino || '%')
      AND cl.deleted_at IS NULL
      AND cl.organization_id = public.org_scope()
    LIMIT limite)
   UNION ALL
   (SELECT p.id, p.nombre AS label, p.rfc AS sublabel, 'proveedor'::text AS tipo, '/proveedores/' || p.id AS url
    FROM proveedores p WHERE (p.nombre ILIKE '%' || termino || '%' OR p.rfc ILIKE '%' || termino || '%')
      -- Ola 4 · N48: filtro que faltaba (las demás ramas ya lo tenían).
      AND p.deleted_at IS NULL
      AND p.organization_id = public.org_scope()
    LIMIT limite)
   UNION ALL
   (SELECT f.id, f.numero AS label, f.cliente_nombre AS sublabel, 'factura'::text AS tipo, '/facturacion/' || f.id AS url
    FROM facturas f WHERE (f.numero ILIKE '%' || termino || '%' OR f.cliente_nombre ILIKE '%' || termino || '%')
      AND f.deleted_at IS NULL
      AND f.organization_id = public.org_scope()
    LIMIT limite)
   UNION ALL
   (SELECT c.id, c.folio AS label, c.cliente_nombre AS sublabel, 'cotizacion'::text AS tipo, '/cotizaciones/' || c.id AS url
    FROM cotizaciones c WHERE (c.folio ILIKE '%' || termino || '%' OR c.cliente_nombre ILIKE '%' || termino || '%' OR c.prospecto_empresa ILIKE '%' || termino || '%')
      AND c.deleted_at IS NULL
      AND c.organization_id = public.org_scope()
    LIMIT limite)
   UNION ALL
   (SELECT pr.id, pr.numero AS label,
           (pr.cliente_nombre || ' · ' || pr.expediente) AS sublabel,
           'proforma'::text AS tipo,
           '/proformas/' || pr.id AS url
    FROM proformas pr
    WHERE (pr.numero ILIKE '%' || termino || '%'
           OR pr.cliente_nombre ILIKE '%' || termino || '%'
           OR pr.expediente ILIKE '%' || termino || '%')
      AND pr.deleted_at IS NULL
      AND pr.organization_id = public.org_scope()
    LIMIT limite)
   UNION ALL
   -- B-062: matchear también por folio_interno (FI-…) — es el folio que la UI
   -- muestra en todas las listas CxP; buscar por él antes devolvía vacío.
   (SELECT pf.id,
           COALESCE(pf.folio_interno, pf.folio_proveedor) AS label,
           (pf.proveedor_nombre
              || COALESCE(' · ' || pv.rfc, '')
              || CASE
                   WHEN pf.folio_interno IS NOT NULL AND pf.folio_proveedor IS NOT NULL
                        AND pf.folio_interno IS DISTINCT FROM pf.folio_proveedor
                     THEN ' · Prov ' || pf.folio_proveedor
                   ELSE ''
                 END) AS sublabel,
           'factura_proveedor'::text AS tipo,
           '/cxp?factura=' || pf.id AS url
    FROM proveedor_facturas pf
    LEFT JOIN proveedores pv ON pv.id = pf.proveedor_id
    WHERE pf.estado <> 'Cancelada'
      AND pf.deleted_at IS NULL
      AND (pf.folio_proveedor ILIKE '%' || termino || '%'
           OR pf.folio_interno ILIKE '%' || termino || '%'
           OR pf.proveedor_nombre ILIKE '%' || termino || '%'
           OR pv.rfc ILIKE '%' || termino || '%')
      AND pf.organization_id = public.org_scope()
    LIMIT limite);
$function$;

REVOKE ALL ON FUNCTION public.busqueda_global(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.busqueda_global(text, integer) TO authenticated, service_role;

-- ============================================================
-- sidebar_alert_counts
-- ============================================================
CREATE OR REPLACE FUNCTION public.sidebar_alert_counts()
RETURNS TABLE(embarques_demora bigint, facturas_vencidas bigint, garantias_atoradas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*) FROM embarques e
     WHERE e.eta IS NOT NULL
       AND e.deleted_at IS NULL
       AND (current_date - e.eta) >= 7
       AND CASE
         WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Cerrado') THEN e.estado::text
         WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación'
              AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
           CASE
             WHEN current_date < e.etd THEN 'Confirmado'
             WHEN current_date >= e.etd AND current_date < e.eta THEN 'En Tránsito'
             WHEN current_date >= e.eta THEN 'Arribo'
             ELSE e.estado::text
           END
         ELSE e.estado::text
       END = 'Arribo'
       AND e.organization_id = public.org_scope()
    ) AS embarques_demora,
    (SELECT count(*) FROM facturas f
     WHERE f.estado = 'Vencida'
       AND f.deleted_at IS NULL
       AND f.organization_id = public.org_scope()
    ) AS facturas_vencidas,
    (SELECT count(*) FROM embarque_garantias_contenedor g
     JOIN embarques e ON e.id = g.embarque_id
     WHERE g.estado = 'depositado'
       AND g.deleted_at IS NULL
       AND e.deleted_at IS NULL
       AND g.fecha_deposito IS NOT NULL
       AND (current_date - g.fecha_deposito) > 30
       AND e.organization_id = public.org_scope()
    ) AS garantias_atoradas;
$$;

REVOKE ALL ON FUNCTION public.sidebar_alert_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sidebar_alert_counts() TO authenticated;