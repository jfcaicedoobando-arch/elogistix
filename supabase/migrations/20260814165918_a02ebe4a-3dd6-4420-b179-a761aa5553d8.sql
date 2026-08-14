-- Ola 15 · Agregadores valuados con el T/C oficial de cada documento.
-- Cascada aplicada por renglon: CFDI > DOF de la fecha oficial > T/C del expediente.

CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque(_embarque_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tc_usd numeric; _tc_eur numeric; _org uuid;
  _has_pf boolean; _has_seg boolean;
  _estado_costos text;
  _fecha_emb date;
  _base jsonb;
BEGIN
  SELECT COALESCE(tipo_cambio_usd,0), COALESCE(tipo_cambio_eur,0), organization_id,
         COALESCE(eta, fecha_llegada_real, etd, fecha_creacion::date)
    INTO _tc_usd, _tc_eur, _org, _fecha_emb
  FROM public.embarques WHERE id = _embarque_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque % no encontrado', _embarque_id;
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND _org IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'Sin acceso al embarque %', _embarque_id USING ERRCODE='42501';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.proveedor_facturas WHERE embarque_id=_embarque_id AND deleted_at IS NULL
                  AND estado::text NOT IN ('Borrador','Cancelada')) INTO _has_pf;
  SELECT EXISTS(SELECT 1 FROM public.seguros_embarque WHERE embarque_id=_embarque_id AND deleted_at IS NULL) INTO _has_seg;

  IF NOT _has_pf AND NOT _has_seg THEN
    _estado_costos := 'incompleto';
  ELSE
    _estado_costos := 'completo';
  END IF;

  WITH
  cv AS (
    SELECT lower(trim(coalesce(descripcion,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(total,0)::numeric AS monto,
           (SELECT t.tc FROM public.tc_para_documento(_fecha_emb, moneda::text, NULL, CASE WHEN UPPER(moneda::text) = 'EUR' THEN _tc_eur ELSE _tc_usd END) t) AS tc_doc
    FROM public.conceptos_venta
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  cc AS (
    SELECT lower(trim(coalesce(concepto,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(monto,0)::numeric AS monto,
           proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           (SELECT t.tc FROM public.tc_para_documento(_fecha_emb, moneda::text, NULL, CASE WHEN UPPER(moneda::text) = 'EUR' THEN _tc_eur ELSE _tc_usd END) t) AS tc_doc
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  seg AS (
    SELECT 'seguro de carga'::text AS concepto, moneda::text AS moneda,
           coalesce(prima,0)::numeric AS monto,
           NULL::uuid AS proveedor_id, aseguradora AS proveedor_nombre,
           (SELECT t.tc FROM public.tc_para_documento(_fecha_emb, moneda::text, NULL, CASE WHEN UPPER(moneda::text) = 'EUR' THEN _tc_eur ELSE _tc_usd END) t) AS tc_doc
    FROM public.seguros_embarque
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  f AS (
    SELECT id, coalesce(subtotal,0)::numeric AS subtotal, moneda::text AS moneda,
           estado::text AS estado, total::numeric AS total,
           (SELECT t.tc FROM public.tc_para_documento(fecha_emision, moneda::text, tipo_cambio, CASE WHEN UPPER(moneda::text) = 'EUR' THEN _tc_eur ELSE _tc_usd END) t) AS tc_doc
    FROM public.facturas
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada','Sustituida')
  ),
  fnc AS (
    SELECT n.factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.factura_notas_credito n
    JOIN f ON f.id = n.factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  f_neto AS (
    SELECT f.id, f.moneda, f.estado, f.tc_doc,
           f.subtotal - coalesce((SELECT sum(monto) FROM fnc WHERE factura_id = f.id),0) AS monto
    FROM f
  ),
  f_saldo AS (
    SELECT f.id, f.moneda, f.estado, f.tc_doc, public.saldo_factura(f.id) AS saldo FROM f
  ),
  pf AS (
    SELECT id, proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           coalesce(NULLIF(total,0), subtotal, 0)::numeric AS total,
           -- Base gravable (sin IVA): subtotal si existe; si no, total menos
           -- impuestos capturados. Nunca negativa.
           GREATEST(
             coalesce(
               NULLIF(subtotal,0),
               coalesce(NULLIF(total,0),0) - coalesce(iva,0) + coalesce(retenciones,0),
               0
             )::numeric, 0)::numeric AS base_gravable,
           moneda::text AS moneda, estado::text AS estado,
           (SELECT t.tc FROM public.tc_para_documento(fecha_emision, moneda::text, tipo_cambio_usd, CASE WHEN UPPER(moneda::text) = 'EUR' THEN _tc_eur ELSE _tc_usd END) t) AS tc_doc
    FROM public.proveedor_facturas
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada')
  ),
  pnc AS (
    SELECT n.proveedor_factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.proveedor_notas_credito n JOIN pf ON pf.id = n.proveedor_factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  pf_neto AS (
    -- Costo real = base gravable menos notas de crédito prorrateadas a esa base.
    SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, pf.moneda, pf.estado, pf.tc_doc,
           pf.base_gravable
             - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0)
               * CASE WHEN pf.total > 0 THEN pf.base_gravable / pf.total ELSE 1 END AS monto
    FROM pf
  ),
  pf_saldo AS (
    SELECT pf.id, pf.moneda, pf.estado, pf.tc_doc,
           (pf.total
              - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0)
              - coalesce((SELECT sum(pp.monto_en_moneda_factura)
                          FROM public.pagos_proveedor pp
                          WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL),0)
           ) AS saldo
    FROM pf
  ),
  totales AS (
    SELECT
      (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM f_neto) AS venta_real_mxn,
      (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM pf_neto)
        + (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM seg) AS costo_real_mxn
  )
  SELECT jsonb_build_object(
    'embarque_id', _embarque_id,
    'tipo_cambio_usd', _tc_usd,
    'tipo_cambio_eur', _tc_eur,
    'estado_costos', _estado_costos,
    'tc_por_documento', true,
    'excluidos_sin_tc', (
      (SELECT count(*) FROM cv WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      + (SELECT count(*) FROM cc WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      + (SELECT count(*) FROM f_neto WHERE moneda <> 'MXN' AND tc_doc IS NULL)
      + (SELECT count(*) FROM pf_neto WHERE moneda <> 'MXN' AND tc_doc IS NULL)
    ),
    'venta', jsonb_build_object(
      'presupuestada_mxn', (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM cv),
      'real_mxn', t.venta_real_mxn,
      'pdte_cobro_mxn', (SELECT coalesce(sum(public.a_mxn(saldo, moneda, tc_doc, tc_doc)),0)
                          FROM f_saldo WHERE estado IN ('Emitida','Vencida','Parcialmente pagada','Por timbrar'))
    ),
    'costo', jsonb_build_object(
      'presupuestado_mxn', (SELECT coalesce(sum(public.a_mxn(monto, moneda, tc_doc, tc_doc)),0) FROM cc),
      'real_mxn', t.costo_real_mxn,
      'pdte_pago_mxn', (SELECT coalesce(sum(public.a_mxn(saldo, moneda, tc_doc, tc_doc)),0)
                         FROM pf_saldo WHERE estado IN ('Vigente','Parcial','Por vencer','Vencida'))
    ),
    'utilidad_mxn', CASE
      WHEN _estado_costos = 'incompleto' THEN NULL
      ELSE round((t.venta_real_mxn - t.costo_real_mxn)::numeric, 2)
    END,
    'por_concepto', (
      SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY (x.presupuestada_mxn + x.real_mxn) DESC), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup),0) AS presupuestada_mxn,
               coalesce(sum(real),0) AS real_mxn
        FROM (
          SELECT concepto,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc) AS presup,
                 0::numeric AS real FROM cv
          UNION ALL
          SELECT lower(trim(coalesce(NULLIF(fc.descripcion,''), '(sin concepto)'))),
                 0::numeric,
                 public.a_mxn(coalesce(fc.total,0), f.moneda, f.tc_doc, f.tc_doc)
          FROM public.conceptos_factura fc
          JOIN f ON f.id = fc.factura_id
          WHERE fc.deleted_at IS NULL
        ) u GROUP BY concepto
      ) x
    ),
    'por_concepto_costo', (
      SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY (x.presupuestado_mxn + x.real_mxn) DESC), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup),0) AS presupuestado_mxn,
               coalesce(sum(real),0) AS real_mxn
        FROM (
          SELECT concepto,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc) AS presup,
                 0::numeric AS real FROM cc
          UNION ALL
          SELECT lower(trim(coalesce(NULLIF(pfc.descripcion,''), '(sin concepto)'))),
                 0::numeric,
                 public.a_mxn(coalesce(pfc.monto, 0), pf.moneda, pf.tc_doc, pf.tc_doc)
          FROM public.proveedor_facturas_conceptos pfc
          JOIN pf ON pf.id = pfc.proveedor_factura_id
          UNION ALL
          SELECT '(factura completa)'::text,
                 0::numeric,
                 public.a_mxn(pf_neto.monto, pf_neto.moneda, pf_neto.tc_doc, pf_neto.tc_doc)
          FROM pf_neto
          WHERE NOT EXISTS (SELECT 1 FROM public.proveedor_facturas_conceptos pfc
                              WHERE pfc.proveedor_factura_id = pf_neto.id)
          UNION ALL
          SELECT concepto, 0::numeric,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc)
          FROM seg
        ) u GROUP BY concepto
      ) x
    ),
    'por_proveedor', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT proveedor_id, proveedor_nombre,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0) AS real_mxn,
               coalesce(sum(facturas_count),0) AS facturas_count
        FROM (
          SELECT proveedor_id, proveedor_nombre,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc) AS presup_mxn,
                 0::numeric AS real_mxn, 0 AS facturas_count FROM cc
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc), 1 FROM pf_neto
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.a_mxn(monto, moneda, tc_doc, tc_doc), 1 FROM seg
        ) u GROUP BY proveedor_id, proveedor_nombre
      ) x
    )
  ) INTO _base FROM totales t;

  RETURN _base;
END;
$function$;

-- FIX-H6: candados de ejecucion en el mismo archivo.
REVOKE ALL ON FUNCTION public.pnl_financiero_embarque(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pnl_financiero_embarque(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.eerr_resumen_anual(p_year integer, p_fuente text DEFAULT 'embarques'::text)
 RETURNS TABLE(mes integer, ingresos_mxn numeric, costos_mxn numeric, excluidos_sin_tc integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.current_user_org_id();
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
        AND f.estado NOT IN ('Cancelada', 'Sustituida')
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
        EXTRACT(month FROM ncf.updated_at)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(ncf.moneda::text, 'MXN'))
            WHEN 'USD' THEN ABS(COALESCE(ncf.monto, 0)) * (SELECT t.tc FROM public.tc_para_documento(ncf.updated_at::date, 'USD', ncf.tipo_cambio, NULL) t)
            WHEN 'EUR' THEN ABS(COALESCE(ncf.monto, 0)) * (SELECT t.tc FROM public.tc_para_documento(ncf.updated_at::date, 'EUR', ncf.tipo_cambio, NULL) t)
            ELSE ABS(COALESCE(ncf.monto, 0))
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(ncf.moneda::text, 'MXN')) IN ('USD','EUR')
            AND (SELECT t.tc FROM public.tc_para_documento(ncf.updated_at::date, ncf.moneda::text, ncf.tipo_cambio, NULL) t) IS NULL
        ) AS sin_tc
      FROM public.factura_notas_credito ncf
      WHERE ncf.deleted_at IS NULL
        AND ncf.organization_id = v_org
        AND ncf.estado = 'Aplicada'
        AND ncf.updated_at IS NOT NULL
        AND EXTRACT(year FROM ncf.updated_at) = p_year
        -- Ola 14 · borrado logico estricto: la NC de una factura eliminada no
        -- puede seguir reduciendo el ingreso del mes.
        AND EXISTS (
          SELECT 1 FROM public.facturas f
          WHERE f.id = ncf.factura_id AND f.deleted_at IS NULL
        )
      GROUP BY EXTRACT(month FROM ncf.updated_at)
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