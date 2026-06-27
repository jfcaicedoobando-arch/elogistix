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
  v_fecha_corte_facturacion constant date := DATE '2026-04-01';
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'p_organization_id es obligatorio';
  END IF;

  PERFORM public._assert_internal_reader(p_organization_id);

  SELECT COALESCE(NULLIF((valor #>> '{}'), '')::numeric, 5)
  INTO v_margen_min_pct
  FROM configuracion
  WHERE categoria = 'auditoria' AND clave = 'margen_minimo_pct'
    AND organization_id = p_organization_id
  LIMIT 1;
  v_margen_min_pct := COALESCE(v_margen_min_pct, 5);

  SELECT COALESCE(NULLIF((valor #>> '{}'), '')::int, 30)
  INTO v_dias_prof_venc
  FROM configuracion
  WHERE categoria = 'auditoria' AND clave = 'dias_proforma_vencida'
    AND organization_id = p_organization_id
  LIMIT 1;
  v_dias_prof_venc := COALESCE(v_dias_prof_venc, 30);

  SELECT COALESCE(NULLIF((valor #>> '{}'), '')::int, 5)
  INTO v_dias_huerfano
  FROM configuracion
  WHERE categoria = 'auditoria' AND clave = 'dias_huerfano'
    AND organization_id = p_organization_id
  LIMIT 1;
  v_dias_huerfano := COALESCE(v_dias_huerfano, 5);

  SELECT COALESCE(NULLIF((valor #>> '{}'), '')::int, 15)
  INTO v_dias_borrador_abandonado
  FROM configuracion
  WHERE categoria = 'auditoria' AND clave = 'dias_borrador_abandonado'
    AND organization_id = p_organization_id
  LIMIT 1;
  v_dias_borrador_abandonado := GREATEST(COALESCE(v_dias_borrador_abandonado, 15), 1);

  WITH
  emb AS (
    SELECT id, expediente, cliente_nombre, modo, estado, etd, eta,
           fecha_llegada_real, tipo_servicio, operador,
           tipo_cambio_usd, tipo_cambio_eur, fecha_creacion
    FROM embarques
    WHERE estado <> 'Cancelado'
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
    CROSS JOIN LATERAL (
      VALUES
        ('Confirmado'::text,
          CASE e.modo::text
            WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List']
            WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque']
            ELSE                  ARRAY['Factura Comercial','Packing List']
          END),
        ('En Tránsito',
          CASE e.modo::text
            WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
            WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
            ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
          END),
        ('En Aduana',
          CASE e.modo::text
            WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
            ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('Llegada',
          CASE e.modo::text
            WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
            ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('Arribo',
          CASE e.modo::text
            WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
            ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('En Proceso',
          CASE e.modo::text
            WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
            ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('Entregado',
          CASE e.modo::text
            WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
            ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('Cerrado',
          CASE e.modo::text
            WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
            ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END)
    ) AS m(estado_match, docs_required)
    CROSS JOIN LATERAL unnest(m.docs_required) AS d(doc_nombre)
    WHERE e.estado::text = m.estado_match
  ),
  faltantes AS (
    SELECT x.embarque_id, x.expediente, x.cliente_nombre, x.modo::text AS modo,
           x.estado::text AS estado, x.eta,
           array_agg(x.doc_nombre ORDER BY x.doc_nombre) AS docs_faltantes
    FROM exigidos x
    LEFT JOIN docs_existentes de
      ON de.embarque_id = x.embarque_id
     AND de.nombre = x.doc_nombre
     AND de.satisfecho = true
    WHERE de.embarque_id IS NULL
    GROUP BY x.embarque_id, x.expediente, x.cliente_nombre, x.modo, x.estado, x.eta
  ),
  hall_docs_faltantes AS (
    SELECT jsonb_build_object(
      'embarque_id', f.embarque_id, 'expediente', f.expediente,
      'cliente_nombre', f.cliente_nombre, 'modo', f.modo, 'estado', f.estado, 'eta', f.eta,
      'regla', 'docs_faltantes',
      'severidad', CASE WHEN f.estado IN ('Confirmado') THEN 'medio' ELSE 'alto' END,
      'detalle', 'Faltan ' || array_length(f.docs_faltantes,1) || ' documento(s) para estado "' || f.estado || '"',
      'documentos_faltantes', to_jsonb(f.docs_faltantes)
    ) AS h
    FROM faltantes f
  ),
  hall_docs_pendientes AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'docs_pendientes_avanzado', 'severidad', 'alto',
      'detalle', 'Hay ' || COUNT(d.id) || ' documento(s) en estado Pendiente con embarque ya en "' || e.estado::text || '"',
      'documentos_faltantes', jsonb_agg(d.nombre ORDER BY d.nombre)
    ) AS h
    FROM emb e
    JOIN documentos_embarque d ON d.embarque_id = e.id
    WHERE e.estado IN ('En Aduana','Llegada','Arribo','Entregado','Cerrado')
      AND d.estado = 'Pendiente' AND d.deleted_at IS NULL
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  hall_fechas AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'fechas', 'severidad', 'medio',
      'detalle', detalle, 'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM (
      SELECT e.*,
        CASE
          WHEN e.estado = 'En Tránsito' AND e.etd IS NULL
            THEN 'Embarque En Tránsito sin ETD registrado'
          WHEN e.estado = 'En Tránsito' AND e.etd > CURRENT_DATE
            THEN 'Embarque En Tránsito con ETD futura ('|| to_char(e.etd,'DD/MM/YYYY') ||')'
          WHEN e.estado IN ('Llegada','Arribo') AND e.fecha_llegada_real IS NULL
            THEN 'Estado "' || e.estado::text || '" sin fecha de llegada real'
          WHEN e.estado = 'Confirmado' AND e.eta IS NOT NULL AND e.eta < CURRENT_DATE - INTERVAL '3 days'
            THEN 'ETA vencida ('|| to_char(e.eta,'DD/MM/YYYY') ||') y embarque sigue en Confirmado'
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
    JOIN conceptos_venta cv ON cv.embarque_id = e.id
    WHERE e.estado IN ('Entregado','Cerrado')
      AND cv.estado_facturacion = 'pendiente'
      AND (e.etd IS NULL OR e.etd >= v_fecha_corte_facturacion)
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  ventas_mxn AS (
    SELECT cv.embarque_id,
           SUM(cv.total * CASE
             WHEN cv.moneda::text = 'USD' THEN COALESCE(NULLIF(e.tipo_cambio_usd,0), 17.5)
             WHEN cv.moneda::text = 'EUR' THEN COALESCE(NULLIF(e.tipo_cambio_eur,0), 19.0)
             ELSE 1
           END) AS total_mxn,
           COUNT(*) AS n
    FROM conceptos_venta cv
    JOIN emb e ON e.id = cv.embarque_id
    GROUP BY cv.embarque_id
  ),
  costos_mxn AS (
    SELECT cc.embarque_id,
           SUM(cc.monto * CASE
             WHEN cc.moneda::text = 'USD' THEN COALESCE(NULLIF(e.tipo_cambio_usd,0), 17.5)
             WHEN cc.moneda::text = 'EUR' THEN COALESCE(NULLIF(e.tipo_cambio_eur,0), 19.0)
             ELSE 1
           END) AS total_mxn,
           COUNT(*) AS n
    FROM conceptos_costo cc
    JOIN emb e ON e.id = cc.embarque_id
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
           COALESCE(c.n, 0) AS n_costos
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
    WHERE p.embarque_id IN (SELECT id FROM emb)
      AND p.deleted_at IS NULL
      AND p.estado_proforma = 'pendiente'
      AND COALESCE(p.estado_aprobacion, 'aprobada') <> 'borrador'
      AND COALESCE(p.total_mxn, 0) > 0
      AND EXISTS (
        SELECT 1 FROM conceptos_venta cv
        WHERE cv.proforma_id = p.id AND cv.deleted_at IS NULL
      )
      AND p.created_at < (now() - (v_dias_prof_venc || ' days')::interval)
  ),
  hall_proforma_vencida AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'proforma_vencida', 'severidad', 'alto',
      'detalle', 'Proforma ' || pp.numero || ' lleva más de ' || v_dias_prof_venc || ' días sin facturar',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM emb e
    JOIN proforma_pend pp ON pp.embarque_id = e.id
  ),
  proforma_borrador AS (
    SELECT p.embarque_id, p.id AS proforma_id, p.numero, p.created_at,
           EXTRACT(DAY FROM (now() - p.created_at))::int AS dias
    FROM proformas p
    WHERE p.embarque_id IN (SELECT id FROM emb)
      AND p.deleted_at IS NULL
      AND p.estado_proforma = 'pendiente'
      AND COALESCE(p.estado_aprobacion, 'aprobada') = 'borrador'
      AND p.created_at < (now() - (v_dias_borrador_abandonado || ' days')::interval)
      AND (
        COALESCE(p.total_mxn, 0) = 0
        OR NOT EXISTS (
          SELECT 1 FROM conceptos_venta cv
          WHERE cv.proforma_id = p.id AND cv.deleted_at IS NULL
        )
      )
  ),
  hall_borrador_abandonado AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'proforma_borrador_abandonada', 'severidad', 'medio',
      'detalle', 'Proforma borrador ' || pb.numero || ' abandonada hace ' || pb.dias || ' días (sin conceptos / total cero)',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM emb e
    JOIN proforma_borrador pb ON pb.embarque_id = e.id
  ),
  proforma_inconsistente AS (
    SELECT DISTINCT p.embarque_id, p.id AS proforma_id, p.numero,
           (SELECT COUNT(*) FROM conceptos_venta cv2
              WHERE cv2.embarque_id = p.embarque_id
                AND cv2.deleted_at IS NULL
                AND cv2.estado_facturacion = 'pendiente'
                AND cv2.proforma_id IS NULL) AS n_pendientes
    FROM proformas p
    WHERE p.embarque_id IN (SELECT id FROM emb)
      AND p.deleted_at IS NULL
      AND p.estado_proforma = 'pendiente'
      AND COALESCE(p.estado_aprobacion, 'aprobada') = 'borrador'
      AND (
        COALESCE(p.total_mxn, 0) = 0
        OR NOT EXISTS (
          SELECT 1 FROM conceptos_venta cv
          WHERE cv.proforma_id = p.id AND cv.deleted_at IS NULL
        )
      )
      AND EXISTS (
        SELECT 1 FROM conceptos_venta cv3
        WHERE cv3.embarque_id = p.embarque_id
          AND cv3.deleted_at IS NULL
          AND cv3.estado_facturacion = 'pendiente'
          AND cv3.proforma_id IS NULL
      )
  ),
  hall_proforma_inconsistente AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'proforma_inconsistente', 'severidad', 'alto',
      'detalle', 'Embarque con ' || pi.n_pendientes || ' concepto(s) pendiente(s) y proforma borrador vacía ' || pi.numero || ' (asignar conceptos o cancelar borrador)',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM emb e
    JOIN proforma_inconsistente pi ON pi.embarque_id = e.id
  ),
  ult_evento AS (
    SELECT embarque_id, MAX(fecha) AS ult
    FROM eventos_embarque
    WHERE embarque_id IN (SELECT id FROM emb) AND deleted_at IS NULL
    GROUP BY embarque_id
  ),
  hall_huerfano AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'embarque_huerfano', 'severidad', 'medio',
      'detalle', CASE
        WHEN COALESCE(e.operador,'') = ''
          THEN 'Embarque sin operador asignado'
        ELSE 'Embarque sin movimientos en los últimos ' || v_dias_huerfano || ' días'
      END,
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM emb e
    LEFT JOIN ult_evento u ON u.embarque_id = e.id
    WHERE e.estado IN ('Confirmado','En Tránsito','En Aduana','Llegada','Arribo','En Proceso')
      AND (
        COALESCE(e.operador,'') = ''
        OR COALESCE(u.ult, e.fecha_creacion) < (now() - (v_dias_huerfano || ' days')::interval)
      )
  ),
  hall_factura_sin_timbrar AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'factura_sin_timbrar', 'severidad', 'alto',
      'detalle', 'Factura ' || f.numero || ' creada hace ' || EXTRACT(DAY FROM (now() - f.created_at))::int || ' día(s) sin timbrar (estado ' || f.estado::text || ')',
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', (f.total * CASE WHEN f.moneda::text = 'MXN' THEN 1 ELSE COALESCE(NULLIF(f.tipo_cambio,0), 1) END)
    ) AS h
    FROM facturas f
    JOIN emb e ON e.id = f.embarque_id
    WHERE f.organization_id = p_organization_id AND f.deleted_at IS NULL
      AND f.uuid_fiscal IS NULL
      AND f.estado IN ('Borrador','Por timbrar')
      AND f.created_at < now() - INTERVAL '48 hours'
  ),
  hall_rep_pendiente AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'rep_pendiente', 'severidad', 'alto',
      'detalle', 'REP pendiente para pago de factura ' || f.numero || ' (registrado hace ' || EXTRACT(DAY FROM (now() - p.created_at))::int || ' día(s))',
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', (p.monto_aplicado_factura * CASE WHEN p.moneda::text = 'MXN' THEN 1 ELSE COALESCE(NULLIF(p.tipo_cambio,0), 1) END)
    ) AS h
    FROM pagos_factura p
    JOIN facturas f ON f.id = p.factura_id
    JOIN emb e ON e.id = f.embarque_id
    WHERE p.organization_id = p_organization_id AND p.deleted_at IS NULL
      AND p.estado_rep = 'Pendiente' AND p.uuid_rep IS NULL
      AND p.created_at < now() - INTERVAL '72 hours'
  ),
  hall_factura_cancel_sin_sust AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'factura_cancelada_sin_sustitucion', 'severidad', 'critico',
      'detalle', 'Factura ' || f.numero || ' cancelada motivo 01 sin folio sustituto emitido',
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', (f.total * CASE WHEN f.moneda::text = 'MXN' THEN 1 ELSE COALESCE(NULLIF(f.tipo_cambio,0), 1) END)
    ) AS h
    FROM facturas f
    JOIN emb e ON e.id = f.embarque_id
    WHERE f.organization_id = p_organization_id AND f.deleted_at IS NULL
      AND f.estado = 'Cancelada'
      AND f.cancelacion_motivo = '01'
      AND f.sustituida_por IS NULL
      AND COALESCE(f.cancelado_en, f.updated_at) < now() - INTERVAL '24 hours'
  ),
  todos AS (
    SELECT h FROM hall_docs_faltantes
    UNION ALL SELECT h FROM hall_docs_pendientes
    UNION ALL SELECT h FROM hall_fechas
    UNION ALL SELECT h FROM hall_ventas
    UNION ALL SELECT h FROM hall_margen_neg
    UNION ALL SELECT h FROM hall_margen_bajo
    UNION ALL SELECT h FROM hall_venta_sin_costo
    UNION ALL SELECT h FROM hall_costo_sin_venta
    UNION ALL SELECT h FROM hall_proforma_vencida
    UNION ALL SELECT h FROM hall_borrador_abandonado
    UNION ALL SELECT h FROM hall_proforma_inconsistente
    UNION ALL SELECT h FROM hall_huerfano
    UNION ALL SELECT h FROM hall_factura_sin_timbrar
    UNION ALL SELECT h FROM hall_rep_pendiente
    UNION ALL SELECT h FROM hall_factura_cancel_sin_sust
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'total_hallazgos', COUNT(*),
    'por_severidad', jsonb_build_object(
      'critico', COUNT(*) FILTER (WHERE h->>'severidad' = 'critico'),
      'alto',    COUNT(*) FILTER (WHERE h->>'severidad' = 'alto'),
      'medio',   COUNT(*) FILTER (WHERE h->>'severidad' = 'medio')
    ),
    'por_regla', jsonb_build_object(
      'docs_faltantes',                COUNT(*) FILTER (WHERE h->>'regla' = 'docs_faltantes'),
      'docs_pendientes_avanzado',      COUNT(*) FILTER (WHERE h->>'regla' = 'docs_pendientes_avanzado'),
      'fechas',                        COUNT(*) FILTER (WHERE h->>'regla' = 'fechas'),
      'ventas_sin_facturar',           COUNT(*) FILTER (WHERE h->>'regla' = 'ventas_sin_facturar'),
      'margen_negativo',               COUNT(*) FILTER (WHERE h->>'regla' = 'margen_negativo'),
      'margen_bajo',                   COUNT(*) FILTER (WHERE h->>'regla' = 'margen_bajo'),
      'venta_sin_costo',               COUNT(*) FILTER (WHERE h->>'regla' = 'venta_sin_costo'),
      'costo_sin_venta',               COUNT(*) FILTER (WHERE h->>'regla' = 'costo_sin_venta'),
      'proforma_vencida',              COUNT(*) FILTER (WHERE h->>'regla' = 'proforma_vencida'),
      'proforma_borrador_abandonada',  COUNT(*) FILTER (WHERE h->>'regla' = 'proforma_borrador_abandonada'),
      'proforma_inconsistente',        COUNT(*) FILTER (WHERE h->>'regla' = 'proforma_inconsistente'),
      'embarque_huerfano',             COUNT(*) FILTER (WHERE h->>'regla' = 'embarque_huerfano'),
      'factura_sin_timbrar',           COUNT(*) FILTER (WHERE h->>'regla' = 'factura_sin_timbrar'),
      'rep_pendiente',                 COUNT(*) FILTER (WHERE h->>'regla' = 'rep_pendiente'),
      'factura_cancelada_sin_sustitucion', COUNT(*) FILTER (WHERE h->>'regla' = 'factura_cancelada_sin_sustitucion')
    ),
    'umbrales', jsonb_build_object(
      'margen_minimo_pct', v_margen_min_pct,
      'dias_proforma_vencida', v_dias_prof_venc,
      'dias_huerfano', v_dias_huerfano,
      'dias_borrador_abandonado', v_dias_borrador_abandonado
    ),
    'hallazgos', COALESCE(jsonb_agg(h ORDER BY
      CASE h->>'severidad' WHEN 'critico' THEN 1 WHEN 'alto' THEN 2 ELSE 3 END,
      h->>'expediente'
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM todos;

  RETURN v_result;
END;
$function$;