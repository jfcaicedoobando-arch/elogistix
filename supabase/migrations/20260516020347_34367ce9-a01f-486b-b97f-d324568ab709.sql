-- ============================================================
-- 1. facturas bucket: hacer privado y aplicar políticas por org
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'facturas';

DROP POLICY IF EXISTS "Public read facturas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload facturas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update facturas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete facturas" ON storage.objects;

-- Path convention: {organization_id}/{proforma_id}/factura.{pdf|xml}
CREATE POLICY "Org members read facturas"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'facturas'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = current_user_org_id()::text
  )
);

CREATE POLICY "Org staff upload facturas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'facturas'
  AND (storage.foldername(name))[1] = current_user_org_id()::text
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE POLICY "Org staff update facturas"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'facturas'
  AND (storage.foldername(name))[1] = current_user_org_id()::text
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE POLICY "Org staff delete facturas"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'facturas'
  AND (storage.foldername(name))[1] = current_user_org_id()::text
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- ============================================================
-- 2. documentos bucket: defensa en profundidad — exigir join a embarques
--    con organization_id coincidente
-- ============================================================
DROP POLICY IF EXISTS "Tenant scoped read documentos" ON storage.objects;

CREATE POLICY "Tenant scoped read documentos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM documentos_embarque d
      JOIN embarques e ON e.id = d.embarque_id
      WHERE d.archivo = storage.objects.name
        AND d.organization_id = current_user_org_id()
        AND e.organization_id = current_user_org_id()
    )
    OR EXISTS (
      SELECT 1
      FROM documentos_embarque d
      JOIN embarques e ON e.id = d.embarque_id
      WHERE d.archivo = storage.objects.name
        AND has_role(auth.uid(), 'cliente'::app_role)
        AND e.cliente_id IN (SELECT current_user_client_ids())
    )
  )
);

-- ============================================================
-- 3. auditoria_embarques_org overload con filtro explícito por org
-- ============================================================
CREATE OR REPLACE FUNCTION public.auditoria_embarques_org(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_margen_min_pct numeric;
  v_dias_prof_venc int;
  v_dias_huerfano int;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'p_organization_id es obligatorio';
  END IF;

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
      'regla', 'docs_pendientes_avanzado', 'severidad', 'critico',
      'detalle', 'Hay ' || COUNT(d.id) || ' documento(s) en estado Pendiente con embarque ya en "' || e.estado::text || '"',
      'documentos_faltantes', jsonb_agg(d.nombre ORDER BY d.nombre)
    ) AS h
    FROM emb e
    JOIN documentos_embarque d ON d.embarque_id = e.id
    WHERE e.estado IN ('En Aduana','Llegada','Arribo','Entregado','Cerrado')
      AND d.estado = 'Pendiente'
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
      AND p.estado_proforma = 'pendiente'
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
  ult_evento AS (
    SELECT embarque_id, MAX(fecha) AS ult
    FROM eventos_embarque
    WHERE embarque_id IN (SELECT id FROM emb)
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
    UNION ALL SELECT h FROM hall_huerfano
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
      'ventas_sin_facturar',      COUNT(*) FILTER (WHERE h->>'regla' = 'ventas_sin_facturar'),
      'margen_negativo',          COUNT(*) FILTER (WHERE h->>'regla' = 'margen_negativo'),
      'margen_bajo',              COUNT(*) FILTER (WHERE h->>'regla' = 'margen_bajo'),
      'venta_sin_costo',          COUNT(*) FILTER (WHERE h->>'regla' = 'venta_sin_costo'),
      'costo_sin_venta',          COUNT(*) FILTER (WHERE h->>'regla' = 'costo_sin_venta'),
      'proforma_vencida',         COUNT(*) FILTER (WHERE h->>'regla' = 'proforma_vencida'),
      'embarque_huerfano',        COUNT(*) FILTER (WHERE h->>'regla' = 'embarque_huerfano')
    ),
    'umbrales', jsonb_build_object(
      'margen_minimo_pct', v_margen_min_pct,
      'dias_proforma_vencida', v_dias_prof_venc,
      'dias_huerfano', v_dias_huerfano
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

REVOKE ALL ON FUNCTION public.auditoria_embarques_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auditoria_embarques_org(uuid) TO service_role;