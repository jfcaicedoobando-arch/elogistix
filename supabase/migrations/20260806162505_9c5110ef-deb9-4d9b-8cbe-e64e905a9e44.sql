CREATE OR REPLACE FUNCTION public.eerr_resumen_anual(p_year integer, p_fuente text DEFAULT 'embarques'::text)
 RETURNS TABLE(mes integer, ingresos_mxn numeric, costos_mxn numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.current_user_org_id();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: usuario sin organización activa' USING ERRCODE='42501';
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
        COALESCE(e.tipo_cambio_usd, 1) AS tc_usd,
        COALESCE(e.tipo_cambio_eur, 1) AS tc_eur
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
            WHEN 'USD' THEN COALESCE(cv.total, 0) * em.tc_usd
            WHEN 'EUR' THEN COALESCE(cv.total, 0) * em.tc_eur
            ELSE COALESCE(cv.total, 0)
          END
        ) AS total
      FROM public.conceptos_venta cv
      JOIN emb em ON em.id = cv.embarque_id
      WHERE cv.deleted_at IS NULL
      GROUP BY em.mes
    ),
    cst AS (
      SELECT em.mes,
        SUM(
          CASE UPPER(COALESCE(cc.moneda::text, 'MXN'))
            WHEN 'USD' THEN COALESCE(cc.monto, 0) * em.tc_usd
            WHEN 'EUR' THEN COALESCE(cc.monto, 0) * em.tc_eur
            ELSE COALESCE(cc.monto, 0)
          END
        ) AS total
      FROM public.conceptos_costo cc
      JOIN emb em ON em.id = cc.embarque_id
      WHERE cc.deleted_at IS NULL
      GROUP BY em.mes
    )
    SELECT m.mes,
           COALESCE(i.total, 0)::numeric AS ingresos_mxn,
           COALESCE(c.total, 0)::numeric AS costos_mxn
    FROM meses m
    LEFT JOIN ing i ON i.mes = m.mes
    LEFT JOIN cst c ON c.mes = m.mes
    ORDER BY m.mes;

  ELSIF p_fuente = 'facturas' THEN
    RETURN QUERY
    WITH meses AS (
      SELECT generate_series(1,12) AS mes
    ),
    fact AS (
      SELECT
        EXTRACT(month FROM f.fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(f.moneda::text, 'MXN'))
            WHEN 'USD' THEN COALESCE(f.total, 0) *
                            COALESCE(NULLIF(e.tipo_cambio_usd, 0), NULLIF(f.tipo_cambio, 0), 1)
            WHEN 'EUR' THEN COALESCE(f.total, 0) *
                            COALESCE(NULLIF(e.tipo_cambio_eur, 0), 1)
            ELSE COALESCE(f.total, 0)
          END
        ) AS total
      FROM public.facturas f
      LEFT JOIN public.embarques e ON e.expediente = f.expediente
                                    AND e.organization_id = v_org
                                    AND e.deleted_at IS NULL
      WHERE f.deleted_at IS NULL
        AND f.organization_id = v_org
        AND f.estado NOT IN ('Cancelada', 'Sustituida')
        AND f.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM f.fecha_emision) = p_year
      GROUP BY EXTRACT(month FROM f.fecha_emision)
    ),
    ncs AS (
      SELECT
        EXTRACT(month FROM ncf.updated_at)::int AS mes,
        SUM(ABS(COALESCE(ncf.monto, 0))) AS total
      FROM public.factura_notas_credito ncf
      WHERE ncf.deleted_at IS NULL
        AND ncf.organization_id = v_org
        AND ncf.estado = 'Aplicada'
        AND ncf.updated_at IS NOT NULL
        AND EXTRACT(year FROM ncf.updated_at) = p_year
      GROUP BY EXTRACT(month FROM ncf.updated_at)
    ),
    pfact AS (
      SELECT
        EXTRACT(month FROM pf.fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(pf.moneda::text, 'MXN'))
            WHEN 'USD' THEN COALESCE(pf.total, 0) *
                            COALESCE(NULLIF(e.tipo_cambio_usd, 0), NULLIF(pf.tipo_cambio_usd, 0), 1)
            WHEN 'EUR' THEN COALESCE(pf.total, 0) *
                            COALESCE(NULLIF(e.tipo_cambio_eur, 0), 1)
            ELSE COALESCE(pf.total, 0)
          END
        ) AS total
      FROM public.proveedor_facturas pf
      LEFT JOIN public.embarques e ON e.id = pf.embarque_id
                                    AND e.organization_id = v_org
                                    AND e.deleted_at IS NULL
      WHERE pf.deleted_at IS NULL
        AND pf.organization_id = v_org
        AND pf.estado <> 'Cancelada'
        AND pf.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM pf.fecha_emision) = p_year
      GROUP BY EXTRACT(month FROM pf.fecha_emision)
    )
    SELECT m.mes,
           (COALESCE(f.total, 0) - COALESCE(n.total, 0))::numeric AS ingresos_mxn,
           COALESCE(p.total, 0)::numeric AS costos_mxn
    FROM meses m
    LEFT JOIN fact f ON f.mes = m.mes
    LEFT JOIN ncs  n ON n.mes = m.mes
    LEFT JOIN pfact p ON p.mes = m.mes
    ORDER BY m.mes;

  ELSE
    RAISE EXCEPTION 'LC_EERR_FUENTE_INVALIDA: fuente=% no reconocida (usa embarques|facturas)', p_fuente USING ERRCODE='22023';
  END IF;
END;
$function$;