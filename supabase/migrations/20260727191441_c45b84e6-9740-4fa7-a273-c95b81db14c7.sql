-- v13.320.12: Auditoria alineada con Tab P&L (excluir conceptos soft-deleted).
-- Antes: la RPC sumaba conceptos_venta/conceptos_costo sin filtrar deleted_at,
-- generando hallazgos "margen_negativo" fantasma cuando había conceptos en papelera.
-- Ahora: filtra AND deleted_at IS NULL en los 5 CTEs que leen conceptos,
-- alineando el resultado con lo que muestra el Tab P&L del detalle.

CREATE OR REPLACE FUNCTION public.auditoria_embarques_org(p_organization_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_margen_min_pct numeric;
  v_dias_prof_venc int;
  v_dias_huerfano int;
  v_dias_borrador_abandonado int;
  v_dias_cxc_vencida int;
  v_dias_cxp_captura int;
  v_dias_cxp_vencida int;
  v_fecha_corte_facturacion constant date := DATE '2026-04-01';
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'p_organization_id es obligatorio';
  END IF;

  PERFORM public._assert_internal_reader(p_organization_id);

  SELECT u.margen_min_pct, u.dias_prof_venc, u.dias_huerfano,
         u.dias_borrador_abandonado, u.dias_cxc_vencida,
         u.dias_cxp_captura, u.dias_cxp_vencida
    INTO v_margen_min_pct, v_dias_prof_venc, v_dias_huerfano,
         v_dias_borrador_abandonado, v_dias_cxc_vencida,
         v_dias_cxp_captura, v_dias_cxp_vencida
    FROM public._audit_embarques_umbrales(p_organization_id) u;


  WITH
  emb AS (
    SELECT id, expediente, cliente_nombre, modo, estado, etd, eta,
           fecha_llegada_real, tipo_servicio, tipo_carga, operador,
           tipo_cambio_usd, tipo_cambio_eur, fecha_creacion
    FROM embarques
    WHERE estado <> 'Cancelado'
      AND deleted_at IS NULL
      AND organization_id = p_organization_id
  ),
  docs_existentes AS (
    SELECT embarque_id, nombre,
           bool_or(archivo IS NOT NULL OR estado = 'No aplica') AS satisfecho
    FROM documentos_embarque
    WHERE embarque_id IN (SELECT id FROM emb) AND deleted_at IS NULL
    GROUP BY embarque_id, nombre
  ),
  exigidos AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta,
           d.doc_nombre
    FROM emb e
    CROSS JOIN LATERAL unnest(
      public._docs_requeridos_por_estado(e.modo::text, e.estado::text)
    ) AS d(doc_nombre)
  ),
  hall_docs_faltantes AS (
    SELECT jsonb_build_object(
      'embarque_id', x.embarque_id, 'expediente', x.expediente,
      'cliente_nombre', x.cliente_nombre, 'modo', x.modo::text, 'estado', x.estado::text, 'eta', x.eta,
      'regla', 'docs_faltantes', 'severidad', 'critico',
      'detalle', 'Documentos faltantes para estado ' || x.estado::text || ': ' || string_agg(x.doc_nombre, ', '),
      'documentos_faltantes', to_jsonb(array_agg(x.doc_nombre))
    ) AS h
    FROM exigidos x
    LEFT JOIN docs_existentes de
      ON de.embarque_id = x.embarque_id AND de.nombre = x.doc_nombre
    WHERE COALESCE(de.satisfecho, false) = false
    GROUP BY x.embarque_id, x.expediente, x.cliente_nombre, x.modo, x.estado, x.eta
  ),
  hall_docs_pendientes AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'docs_pendientes_avanzado', 'severidad', 'alto',
      'detalle', 'Documentos en estado Pendiente: ' || string_agg(d.nombre, ', '),
      'documentos_faltantes', to_jsonb(array_agg(d.nombre))
    ) AS h
    FROM emb e
    JOIN documentos_embarque d ON d.embarque_id = e.id AND d.deleted_at IS NULL
    WHERE e.estado IN ('En Aduana','Llegada','Arribo','Entregado','Cerrado')
      AND d.estado = 'Pendiente'
      AND d.nombre = ANY(public._docs_requeridos_por_estado(e.modo::text, e.estado::text))
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  hall_fechas AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'fechas', 'severidad', 'alto',
      'detalle', e.detalle,
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM (
      SELECT e.*, CASE
          WHEN e.estado = 'En Tránsito' AND e.etd IS NULL THEN 'Embarque En Tránsito sin ETD'
          WHEN e.estado = 'En Tránsito' AND e.eta IS NULL THEN 'Embarque En Tránsito sin ETA'
          WHEN e.estado IN ('Entregado','Cerrado') AND e.fecha_llegada_real IS NULL
            THEN 'Embarque ' || e.estado::text || ' sin fecha de llegada real'
        END AS detalle
      FROM emb e
    ) e
    WHERE detalle IS NOT NULL
  ),
  hall_ventas AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'ventas_sin_facturar', 'severidad', 'critico',
      'detalle', COUNT(cv.id) || ' concepto(s) de venta pendientes de facturar (' || to_char(SUM(cv.total),'FM999,999,990.00') || ' ' || COALESCE(MAX(cv.moneda::text),'MXN') || ')',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM emb e
    JOIN conceptos_venta cv ON cv.embarque_id = e.id AND cv.deleted_at IS NULL
    WHERE e.estado IN ('Entregado','Cerrado')
      AND cv.estado_facturacion = 'pendiente'
      AND (e.etd IS NULL OR e.etd >= v_fecha_corte_facturacion)
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  emb_sin_tc AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta,
           bool_or(cv.moneda::text = 'USD') AS tiene_usd_venta,
           bool_or(cv.moneda::text = 'EUR') AS tiene_eur_venta
    FROM emb e
    JOIN conceptos_venta cv ON cv.embarque_id = e.id AND cv.deleted_at IS NULL
    WHERE cv.moneda::text IN ('USD','EUR')
      AND (
        (cv.moneda::text = 'USD' AND COALESCE(NULLIF(e.tipo_cambio_usd,0),0) = 0)
        OR (cv.moneda::text = 'EUR' AND COALESCE(NULLIF(e.tipo_cambio_eur,0),0) = 0)
      )
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  emb_sin_tc_costo AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta,
           bool_or(cc.moneda::text = 'USD') AS tiene_usd_costo,
           bool_or(cc.moneda::text = 'EUR') AS tiene_eur_costo
    FROM emb e
    JOIN conceptos_costo cc ON cc.embarque_id = e.id AND cc.deleted_at IS NULL
    WHERE cc.moneda::text IN ('USD','EUR')
      AND (
        (cc.moneda::text = 'USD' AND COALESCE(NULLIF(e.tipo_cambio_usd,0),0) = 0)
        OR (cc.moneda::text = 'EUR' AND COALESCE(NULLIF(e.tipo_cambio_eur,0),0) = 0)
      )
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  emb_falta_tc AS (
    SELECT COALESCE(v.embarque_id, c.embarque_id) AS embarque_id,
           COALESCE(v.expediente, c.expediente) AS expediente,
           COALESCE(v.cliente_nombre, c.cliente_nombre) AS cliente_nombre,
           COALESCE(v.modo, c.modo) AS modo,
           COALESCE(v.estado, c.estado) AS estado,
           COALESCE(v.eta, c.eta) AS eta,
           COALESCE(v.tiene_usd_venta, false) OR COALESCE(c.tiene_usd_costo, false) AS falta_usd,
           COALESCE(v.tiene_eur_venta, false) OR COALESCE(c.tiene_eur_costo, false) AS falta_eur
    FROM emb_sin_tc v
    FULL OUTER JOIN emb_sin_tc_costo c ON c.embarque_id = v.embarque_id
  ),
  hall_tipo_cambio_faltante AS (
    SELECT jsonb_build_object(
      'embarque_id', f.embarque_id, 'expediente', f.expediente,
      'cliente_nombre', f.cliente_nombre, 'modo', f.modo::text, 'estado', f.estado::text, 'eta', f.eta,
      'regla', 'tipo_cambio_faltante', 'severidad', 'medio',
      'detalle', 'Embarque tiene conceptos en ' ||
        CASE
          WHEN f.falta_usd AND f.falta_eur THEN 'USD y EUR'
          WHEN f.falta_usd THEN 'USD'
          ELSE 'EUR'
        END || ' sin tipo de cambio capturado; el margen no se calcula hasta corregir.',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM emb_falta_tc f
  ),
  ventas_mxn AS (
    SELECT cv.embarque_id,
           SUM(cv.total * CASE
             WHEN cv.moneda::text = 'USD' THEN NULLIF(e.tipo_cambio_usd,0)
             WHEN cv.moneda::text = 'EUR' THEN NULLIF(e.tipo_cambio_eur,0)
             ELSE 1
           END) AS total_mxn,
           COUNT(*) AS n,
           bool_or(
             (cv.moneda::text = 'USD' AND COALESCE(NULLIF(e.tipo_cambio_usd,0),0) = 0)
             OR (cv.moneda::text = 'EUR' AND COALESCE(NULLIF(e.tipo_cambio_eur,0),0) = 0)
           ) AS tc_incompleto
    FROM conceptos_venta cv
    JOIN emb e ON e.id = cv.embarque_id
    WHERE cv.deleted_at IS NULL
    GROUP BY cv.embarque_id
  ),
  costos_mxn AS (
    SELECT cc.embarque_id,
           SUM(cc.monto * CASE
             WHEN cc.moneda::text = 'USD' THEN NULLIF(e.tipo_cambio_usd,0)
             WHEN cc.moneda::text = 'EUR' THEN NULLIF(e.tipo_cambio_eur,0)
             ELSE 1
           END) AS total_mxn,
           COUNT(*) AS n,
           bool_or(
             (cc.moneda::text = 'USD' AND COALESCE(NULLIF(e.tipo_cambio_usd,0),0) = 0)
             OR (cc.moneda::text = 'EUR' AND COALESCE(NULLIF(e.tipo_cambio_eur,0),0) = 0)
           ) AS tc_incompleto
    FROM conceptos_costo cc
    JOIN emb e ON e.id = cc.embarque_id
    WHERE cc.deleted_at IS NULL
    GROUP BY cc.embarque_id
  ),
  margenes AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo::text AS modo,
           e.estado::text AS estado, e.eta,
           COALESCE(v.total_mxn, 0) AS venta_mxn,
           COALESCE(c.total_mxn, 0) AS costo_mxn,
           COALESCE(v.total_mxn, 0) - COALESCE(c.total_mxn, 0) AS utilidad_mxn,
           CASE WHEN COALESCE(v.total_mxn, 0) = 0 THEN NULL
                ELSE ((COALESCE(v.total_mxn,0) - COALESCE(c.total_mxn,0)) / v.total_mxn) * 100
           END AS margen_pct,
           COALESCE(v.n, 0) AS n_ventas,
           COALESCE(c.n, 0) AS n_costos,
           COALESCE(v.tc_incompleto, false) OR COALESCE(c.tc_incompleto, false) AS tc_incompleto
    FROM emb e
    LEFT JOIN ventas_mxn v ON v.embarque_id = e.id
    LEFT JOIN costos_mxn c ON c.embarque_id = e.id
    WHERE e.estado IN ('Entregado','Cerrado','En Proceso','Llegada','Arribo')
  ),
  hall_margen_neg AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'margen_negativo', 'severidad', 'critico',
      'detalle', 'Margen negativo: ' || to_char(m.utilidad_mxn,'FM999,999,990.00') || ' MXN',
      'monto_mxn', m.utilidad_mxn,
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM margenes m
    WHERE m.utilidad_mxn < 0
      AND NOT m.tc_incompleto
  ),
  hall_margen_bajo AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'margen_bajo', 'severidad', 'medio',
      'detalle', 'Margen ' || to_char(m.margen_pct,'FM990.0') || '% por debajo del mínimo (' || v_margen_min_pct || '%)',
      'monto_mxn', m.utilidad_mxn,
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM margenes m
    WHERE m.margen_pct IS NOT NULL
      AND m.margen_pct >= 0
      AND m.margen_pct < v_margen_min_pct
      AND NOT m.tc_incompleto
  ),
  hall_venta_sin_costo AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'venta_sin_costo', 'severidad', 'alto',
      'detalle', 'Embarque tiene ventas pero ningún costo registrado',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM margenes m
    WHERE m.n_ventas > 0 AND m.n_costos = 0
  ),
  hall_costo_sin_venta AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'costo_sin_venta', 'severidad', 'alto',
      'detalle', 'Embarque tiene costos pero ninguna venta registrada',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM margenes m
    WHERE m.n_costos > 0 AND m.n_ventas = 0
  ),
  proforma_pend AS (
    SELECT p.embarque_id, p.id AS proforma_id, p.numero, p.created_at
    FROM proformas p
    WHERE p.estado = 'Pendiente'
      AND p.embarque_id IN (SELECT id FROM emb)
      AND p.deleted_at IS NULL
      AND p.created_at < now() - (v_dias_prof_venc || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM conceptos_venta cv
        WHERE cv.proforma_id = p.id AND cv.deleted_at IS NULL
      )
  ),
  hall_prof_vencida AS (
    SELECT jsonb_build_object(
      'embarque_id', pp.embarque_id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'proforma_vencida', 'severidad', 'alto',
      'detalle', 'Proforma ' || pp.numero || ' pendiente > ' || v_dias_prof_venc || ' días sin conceptos',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM proforma_pend pp
    JOIN emb e ON e.id = pp.embarque_id
  ),
  proforma_huerfana AS (
    SELECT p.id AS proforma_id, p.numero, p.created_at
    FROM proformas p
    WHERE p.embarque_id IS NULL
      AND p.estado <> 'Cancelada'
      AND p.deleted_at IS NULL
      AND p.organization_id = p_organization_id
      AND p.created_at < now() - (v_dias_huerfano || ' days')::interval
      AND (
        NOT EXISTS (
          SELECT 1 FROM conceptos_venta cv
          WHERE cv.proforma_id = p.id AND cv.deleted_at IS NULL
        )
        OR EXISTS (
          SELECT 1
          FROM proforma_conceptos_consolidados pcc
          WHERE pcc.proforma_id = p.id
            AND pcc.embarque_id IS NULL
            AND (SELECT COUNT(*) FROM conceptos_venta cv2
                   WHERE cv2.proforma_id = p.id
                     AND cv2.deleted_at IS NULL
                     AND cv2.embarque_id IS NOT NULL) = 0
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM conceptos_venta cv
        WHERE cv.proforma_id = p.id AND cv.deleted_at IS NULL
          AND cv.embarque_id IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM conceptos_venta cv3
        WHERE cv3.proforma_id = p.id
          AND cv3.deleted_at IS NULL
          AND cv3.embarque_id IS NULL
      )
  ),
  hall_prof_huerfana AS (
    SELECT jsonb_build_object(
      'embarque_id', NULL::uuid, 'proforma_id', ph.proforma_id,
      'numero_proforma', ph.numero,
      'regla', 'proforma_huerfana', 'severidad', 'medio',
      'detalle', 'Proforma huérfana (sin embarque) > ' || v_dias_huerfano || ' días',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM proforma_huerfana ph
  ),
  proforma_conceptos AS (
    SELECT DISTINCT cv.proforma_id
    FROM conceptos_venta cv
    WHERE embarque_id IN (SELECT id FROM emb) AND deleted_at IS NULL
      AND cv.proforma_id IS NOT NULL
  ),
  proforma_facturas AS (
    SELECT p.id, p.numero, p.estado::text AS estado_prof,
           coalesce(f.saldo, 0) AS saldo,
           f.estado::text AS estado_fact,
           e.id AS embarque_id
    FROM proformas p
    JOIN (SELECT proforma_id FROM proforma_conceptos) pc ON pc.proforma_id = p.id
    JOIN conceptos_venta cv ON cv.proforma_id = p.id AND cv.deleted_at IS NULL
    JOIN emb e ON e.id = cv.embarque_id
    LEFT JOIN LATERAL (
      SELECT f.estado, public.saldo_factura(f.id) AS saldo
      FROM facturas f
      WHERE f.proforma_id = p.id
        AND f.deleted_at IS NULL
        AND f.estado NOT IN ('Cancelada','Sustituida')
      ORDER BY f.created_at DESC
      LIMIT 1
    ) f ON TRUE
    WHERE p.deleted_at IS NULL
    GROUP BY p.id, p.numero, p.estado, f.saldo, f.estado, e.id
  ),
  hall_facturacion_operacional AS (
    SELECT jsonb_build_object(
      'embarque_id', pf.embarque_id,
      'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre,
      'modo', e.modo::text,
      'estado', e.estado::text,
      'eta', e.eta,
      'proforma_id', pf.id,
      'numero_proforma', pf.numero,
      'regla', 'facturacion_operacional_pendiente',
      'severidad', 'medio',
      'detalle', 'Proforma ' || pf.numero || ' Facturada operativa pero factura ' ||
                 CASE WHEN pf.estado_fact IS NULL THEN 'no encontrada'
                      WHEN pf.saldo > 0 THEN 'con saldo pendiente (' || to_char(pf.saldo,'FM999,999,990.00') || ')'
                      ELSE 'en estado ' || pf.estado_fact
                 END,
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM proforma_facturas pf
    JOIN emb e ON e.id = pf.embarque_id
    WHERE pf.estado_prof = 'Facturada'
      AND (pf.estado_fact IS NULL OR pf.saldo > 0)
  ),
  cxc_facturas AS (
    SELECT f.id, f.folio, f.total, public.saldo_factura(f.id) AS saldo,
           f.fecha_pago_esperada, f.moneda,
           f.embarque_id, f.cliente_id
    FROM facturas f
    WHERE f.organization_id = p_organization_id
      AND f.deleted_at IS NULL
      AND f.estado::text NOT IN ('Cancelada','Sustituida','Borrador','Pagada')
      AND f.fecha_pago_esperada IS NOT NULL
      AND f.fecha_pago_esperada < CURRENT_DATE - (v_dias_cxc_vencida || ' days')::interval
      AND public.saldo_factura(f.id) > 0
  ),
  hall_cxc_vencida AS (
    SELECT jsonb_build_object(
      'embarque_id', cxc.embarque_id,
      'factura_id', cxc.id,
      'folio_factura', cxc.folio,
      'regla', 'cxc_vencida', 'severidad', 'alto',
      'detalle', 'Factura ' || cxc.folio || ' vencida hace ' ||
                 (CURRENT_DATE - cxc.fecha_pago_esperada) || ' días · saldo ' ||
                 to_char(cxc.saldo,'FM999,999,990.00') || ' ' || cxc.moneda::text,
      'monto_mxn', public.convertir_a_mxn(cxc.saldo, cxc.moneda::text, NULL, NULL),
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM cxc_facturas cxc
  ),
  pf_cxp AS (
    SELECT pf.id, pf.folio_interno, pf.fecha_recepcion, pf.fecha_vencimiento,
           pf.total, pf.moneda, pf.estado_aprobacion, pf.estado::text AS estado,
           pf.embarque_id, pf.organization_id,
           public.saldo_proveedor_factura(pf.id) AS saldo
    FROM proveedor_facturas pf
    WHERE pf.organization_id = p_organization_id
      AND pf.deleted_at IS NULL
  ),
  hall_cxp_captura AS (
    SELECT jsonb_build_object(
      'embarque_id', pfc.embarque_id,
      'proveedor_factura_id', pfc.id,
      'folio_factura', pfc.folio_interno,
      'regla', 'cxp_captura_lenta', 'severidad', 'medio',
      'detalle', 'Factura de proveedor ' || pfc.folio_interno ||
                 ' recibida hace ' || (CURRENT_DATE - pfc.fecha_recepcion) ||
                 ' días sin aprobar (' || pfc.estado_aprobacion::text || ')',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM pf_cxp pfc
    WHERE pfc.estado_aprobacion = 'pendiente'
      AND pfc.fecha_recepcion IS NOT NULL
      AND pfc.fecha_recepcion < CURRENT_DATE - (v_dias_cxp_captura || ' days')::interval
  ),
  hall_cxp_vencida AS (
    SELECT jsonb_build_object(
      'embarque_id', pfc.embarque_id,
      'proveedor_factura_id', pfc.id,
      'folio_factura', pfc.folio_interno,
      'regla', 'cxp_vencida', 'severidad', 'alto',
      'detalle', 'Factura de proveedor ' || pfc.folio_interno || ' vencida hace ' ||
                 (CURRENT_DATE - pfc.fecha_vencimiento) || ' días · saldo ' ||
                 to_char(pfc.saldo,'FM999,999,990.00') || ' ' || pfc.moneda::text,
      'monto_mxn', public.convertir_a_mxn(pfc.saldo, pfc.moneda::text, NULL, NULL),
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM pf_cxp pfc
    WHERE pfc.estado_aprobacion = 'aprobada'
      AND pfc.estado <> 'Pagada'
      AND pfc.fecha_vencimiento IS NOT NULL
      AND pfc.fecha_vencimiento < CURRENT_DATE - (v_dias_cxp_vencida || ' days')::interval
      AND pfc.saldo > 0
  ),
  embarques_abandonados AS (
    SELECT e.id, e.expediente, e.cliente_nombre, e.modo::text AS modo,
           e.estado::text AS estado, e.eta, e.fecha_creacion
    FROM emb e
    JOIN embarque_contenedores ec ON ec.embarque_id = e.id AND ec.deleted_at IS NULL
    WHERE e.estado = 'Borrador'
      AND e.fecha_creacion < now() - (v_dias_borrador_abandonado || ' days')::interval
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta, e.fecha_creacion
  ),
  hall_borrador_abandonado AS (
    SELECT jsonb_build_object(
      'embarque_id', eab.id, 'expediente', eab.expediente,
      'cliente_nombre', eab.cliente_nombre, 'modo', eab.modo, 'estado', eab.estado, 'eta', eab.eta,
      'regla', 'borrador_abandonado', 'severidad', 'medio',
      'detalle', 'Borrador sin actualizar hace ' ||
                 date_part('day', now() - eab.fecha_creacion)::int || ' días',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM embarques_abandonados eab
  ),
  cxc_credit_notes AS (
    SELECT DISTINCT f.id AS factura_id
    FROM facturas f
    JOIN embarque_contenedores ec ON ec.embarque_id = f.embarque_id AND ec.deleted_at IS NULL
    JOIN factura_notas_credito nc ON nc.factura_id = f.id
    WHERE f.organization_id = p_organization_id
      AND f.deleted_at IS NULL
      AND nc.estado = 'Aplicada'
      AND (public.saldo_factura(f.id) < 0)
  ),
  hall_credit_note_over AS (
    SELECT jsonb_build_object(
      'factura_id', ccn.factura_id,
      'regla', 'nota_credito_sobreabonada',
      'severidad', 'alto',
      'detalle', 'Saldo negativo por nota de crédito aplicada superior a factura',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM cxc_credit_notes ccn
  ),
  all_hall AS (
    SELECT h FROM hall_docs_faltantes
    UNION ALL SELECT h FROM hall_docs_pendientes
    UNION ALL SELECT h FROM hall_fechas
    UNION ALL SELECT h FROM hall_ventas
    UNION ALL SELECT h FROM hall_tipo_cambio_faltante
    UNION ALL SELECT h FROM hall_margen_neg
    UNION ALL SELECT h FROM hall_margen_bajo
    UNION ALL SELECT h FROM hall_venta_sin_costo
    UNION ALL SELECT h FROM hall_costo_sin_venta
    UNION ALL SELECT h FROM hall_prof_vencida
    UNION ALL SELECT h FROM hall_prof_huerfana
    UNION ALL SELECT h FROM hall_facturacion_operacional
    UNION ALL SELECT h FROM hall_cxc_vencida
    UNION ALL SELECT h FROM hall_cxp_captura
    UNION ALL SELECT h FROM hall_cxp_vencida
    UNION ALL SELECT h FROM hall_borrador_abandonado
    UNION ALL SELECT h FROM hall_credit_note_over
  )
  SELECT jsonb_build_object(
    'hallazgos', COALESCE(jsonb_agg(h ORDER BY h->>'expediente'), '[]'::jsonb),
    'umbrales', jsonb_build_object(
      'margen_minimo_pct', v_margen_min_pct,
      'dias_proforma_vencida', v_dias_prof_venc,
      'dias_huerfano', v_dias_huerfano,
      'dias_borrador_abandonado', v_dias_borrador_abandonado,
      'dias_cxc_vencida', v_dias_cxc_vencida,
      'dias_cxp_captura', v_dias_cxp_captura,
      'dias_cxp_vencida', v_dias_cxp_vencida,
      'fecha_corte_facturacion', v_fecha_corte_facturacion
    )
  )
  INTO v_result
  FROM all_hall;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.auditoria_embarques_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auditoria_embarques_org(uuid) TO authenticated, service_role;
