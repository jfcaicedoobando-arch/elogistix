CREATE OR REPLACE FUNCTION public.auditoria_embarques_org()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_hallazgos jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  WITH
  emb AS (
    SELECT id, expediente, cliente_nombre, modo, estado, etd, eta,
           fecha_llegada_real, tipo_servicio
    FROM embarques
    WHERE estado <> 'Cancelado'
  ),
  -- Regla 1: documentos faltantes según estado
  docs_existentes AS (
    SELECT embarque_id, nombre,
           bool_or(archivo IS NOT NULL) AS tiene_archivo
    FROM documentos_embarque
    WHERE embarque_id IN (SELECT id FROM emb)
    GROUP BY embarque_id, nombre
  ),
  exigidos AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta,
           d.doc_nombre
    FROM emb e
    CROSS JOIN LATERAL (
      VALUES
        ('Confirmado'::text, ARRAY['Factura Comercial','Packing List']),
        ('En Tránsito',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
          END),
        ('En Aduana',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('Llegada',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('Arribo',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('En Proceso',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica','EIR']
          END),
        ('Entregado',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica','EIR']
          END),
        ('Cerrado',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica','EIR']
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
     AND de.tiene_archivo = true
    WHERE de.embarque_id IS NULL
    GROUP BY x.embarque_id, x.expediente, x.cliente_nombre, x.modo, x.estado, x.eta
  ),
  hall_docs_faltantes AS (
    SELECT jsonb_build_object(
      'embarque_id', f.embarque_id,
      'expediente', f.expediente,
      'cliente_nombre', f.cliente_nombre,
      'modo', f.modo,
      'estado', f.estado,
      'eta', f.eta,
      'regla', 'docs_faltantes',
      'severidad',
        CASE WHEN f.estado IN ('Confirmado') THEN 'medio'
             ELSE 'alto' END,
      'detalle', 'Faltan ' || array_length(f.docs_faltantes,1) || ' documento(s) para estado "' || f.estado || '"',
      'documentos_faltantes', to_jsonb(f.docs_faltantes)
    ) AS h
    FROM faltantes f
  ),
  -- Regla 2: documentos Pendiente con embarque avanzado
  hall_docs_pendientes AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id,
      'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre,
      'modo', e.modo::text,
      'estado', e.estado::text,
      'eta', e.eta,
      'regla', 'docs_pendientes_avanzado',
      'severidad', 'critico',
      'detalle', 'Hay ' || COUNT(d.id) || ' documento(s) en estado Pendiente con embarque ya en "' || e.estado::text || '"',
      'documentos_faltantes', jsonb_agg(d.nombre ORDER BY d.nombre)
    ) AS h
    FROM emb e
    JOIN documentos_embarque d ON d.embarque_id = e.id
    WHERE e.estado IN ('En Aduana','Llegada','Arribo','Entregado','Cerrado')
      AND d.estado = 'Pendiente'
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  -- Regla 3: fechas inconsistentes
  hall_fechas AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id,
      'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre,
      'modo', e.modo::text,
      'estado', e.estado::text,
      'eta', e.eta,
      'regla', 'fechas',
      'severidad', 'medio',
      'detalle', detalle,
      'documentos_faltantes', '[]'::jsonb
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
  -- Regla 4: ventas sin facturar en cerrados
  hall_ventas AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id,
      'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre,
      'modo', e.modo::text,
      'estado', e.estado::text,
      'eta', e.eta,
      'regla', 'ventas_sin_facturar',
      'severidad', 'critico',
      'detalle', COUNT(cv.id) || ' concepto(s) de venta pendientes de facturar (' || to_char(SUM(cv.total),'FM999,999,990.00') || ' ' || COALESCE(MAX(cv.moneda::text),'MXN') || ')',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM emb e
    JOIN conceptos_venta cv ON cv.embarque_id = e.id
    WHERE e.estado IN ('Entregado','Cerrado')
      AND cv.estado_facturacion = 'pendiente'
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  todos AS (
    SELECT h FROM hall_docs_faltantes
    UNION ALL SELECT h FROM hall_docs_pendientes
    UNION ALL SELECT h FROM hall_fechas
    UNION ALL SELECT h FROM hall_ventas
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
      'docs_faltantes',           COUNT(*) FILTER (WHERE h->>'regla' = 'docs_faltantes'),
      'docs_pendientes_avanzado', COUNT(*) FILTER (WHERE h->>'regla' = 'docs_pendientes_avanzado'),
      'fechas',                   COUNT(*) FILTER (WHERE h->>'regla' = 'fechas'),
      'ventas_sin_facturar',      COUNT(*) FILTER (WHERE h->>'regla' = 'ventas_sin_facturar')
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
$$;

GRANT EXECUTE ON FUNCTION public.auditoria_embarques_org() TO authenticated;