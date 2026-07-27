-- Fuente canónica de public.auditoria_embarques_org
-- Regenerada desde DB. Cada cambio DEBE actualizarse aquí en el mismo PR que la migración correspondiente.
-- Ver supabase/schema/README.md.

-- === Overload 1/2 ===
CREATE OR REPLACE FUNCTION public.auditoria_embarques_org()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid;
BEGIN
  v_caller_org := public.current_user_org_id();
  IF v_caller_org IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  PERFORM public._assert_internal_reader(v_caller_org);
  -- Delegar a la variante con parámetro (que ahora también valida).
  RETURN public.auditoria_embarques_org(v_caller_org);
END;
$function$
 name:auditoria_embarques_org schema:public;

-- === Helper interno: carga de umbrales configurables ===
-- Consolida los 7 SELECT INTO originales en una sola llamada (ítem 3.2.a).
-- Mantiene los mismos defaults y clamps que el bloque original.
CREATE OR REPLACE FUNCTION public._audit_embarques_umbrales(p_organization_id uuid)
RETURNS TABLE(
  margen_min_pct numeric,
  dias_prof_venc int,
  dias_huerfano int,
  dias_borrador_abandonado int,
  dias_cxc_vencida int,
  dias_cxp_captura int,
  dias_cxp_vencida int
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH cfg AS (
    SELECT clave, (valor #>> '{}') AS v
    FROM configuracion
    WHERE organization_id = p_organization_id
      AND categoria = 'auditoria'
      AND clave IN (
        'margen_minimo_pct',
        'dias_proforma_vencida',
        'dias_huerfano',
        'dias_borrador_abandonado',
        'dias_cxc_vencida',
        'dias_cxp_captura',
        'dias_cxp_vencida'
      )
  )
  SELECT
    COALESCE((SELECT NULLIF(v,'')::numeric FROM cfg WHERE clave = 'margen_minimo_pct'), 5)::numeric               AS margen_min_pct,
    COALESCE((SELECT NULLIF(v,'')::int     FROM cfg WHERE clave = 'dias_proforma_vencida'), 30)::int              AS dias_prof_venc,
    COALESCE((SELECT NULLIF(v,'')::int     FROM cfg WHERE clave = 'dias_huerfano'), 5)::int                       AS dias_huerfano,
    GREATEST(COALESCE((SELECT NULLIF(v,'')::int FROM cfg WHERE clave = 'dias_borrador_abandonado'), 15), 1)::int  AS dias_borrador_abandonado,
    GREATEST(COALESCE((SELECT NULLIF(v,'')::int FROM cfg WHERE clave = 'dias_cxc_vencida'), 0), 0)::int           AS dias_cxc_vencida,
    GREATEST(COALESCE((SELECT NULLIF(v,'')::int FROM cfg WHERE clave = 'dias_cxp_captura'), 7), 1)::int           AS dias_cxp_captura,
    GREATEST(COALESCE((SELECT NULLIF(v,'')::int FROM cfg WHERE clave = 'dias_cxp_vencida'), 0), 0)::int           AS dias_cxp_vencida;
$$
 name:_audit_embarques_umbrales schema:public;

-- === Helper interno: agregador final (ítem 3.2.b) ===
-- Toma el arreglo de hallazgos ya construido + el objeto de umbrales y devuelve
-- el reporte final (`generated_at`, `total_hallazgos`, `por_severidad`, `por_regla`,
-- `umbrales`, `hallazgos` ordenados por severidad y expediente).
CREATE OR REPLACE FUNCTION public._audit_embarques_agregar(
  p_hallazgos jsonb,
  p_umbrales jsonb
) RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $agg$
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
      'factura_cancelada_sin_sustitucion', COUNT(*) FILTER (WHERE h->>'regla' = 'factura_cancelada_sin_sustitucion'),
      'cxc_vencida',                   COUNT(*) FILTER (WHERE h->>'regla' = 'cxc_vencida'),
      'cxp_por_capturar_estancada',    COUNT(*) FILTER (WHERE h->>'regla' = 'cxp_por_capturar_estancada'),
      'cxp_vencida',                   COUNT(*) FILTER (WHERE h->>'regla' = 'cxp_vencida'),
      'contenedor_datos_incompletos',  COUNT(*) FILTER (WHERE h->>'regla' = 'contenedor_datos_incompletos'),
      'contenedor_fechas_incompletas', COUNT(*) FILTER (WHERE h->>'regla' = 'contenedor_fechas_incompletas'),
      'tipo_cambio_faltante',          COUNT(*) FILTER (WHERE h->>'regla' = 'tipo_cambio_faltante')
    ),
    'umbrales', p_umbrales,
    'hallazgos', COALESCE(jsonb_agg(h ORDER BY
      CASE h->>'severidad' WHEN 'critico' THEN 1 WHEN 'alto' THEN 2 ELSE 3 END,
      h->>'expediente'
    ), '[]'::jsonb)
  )
  FROM jsonb_array_elements(COALESCE(p_hallazgos, '[]'::jsonb)) AS t(h);
$agg$
 name:_audit_embarques_agregar schema:public;

-- === Overload 2/2 ===
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
      AND deleted_at IS NULL  -- AUD-2: excluir soft-deleted
      AND organization_id = p_organization_id
  ),
  docs_existentes AS (
    SELECT embarque_id, nombre,
           bool_or(archivo IS NOT NULL OR estado = 'No aplica') AS satisfecho
    FROM documentos_embarque
    WHERE embarque_id IN (SELECT id FROM emb) AND deleted_at IS NULL
    GROUP BY embarque_id, nombre
  ),
  -- AUD-2: usar la matriz canónica en vez de una copia hardcodeada.
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
  -- AUD-2: sólo docs Pendiente que realmente aplican al modo/estado actual.
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
  -- AUD-2: detectar embarques con conceptos en moneda extranjera sin TC.
  emb_sin_tc AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta,
           bool_or(cv.moneda::text = 'USD') AS tiene_usd_venta,
           bool_or(cv.moneda::text = 'EUR') AS tiene_eur_venta
    FROM emb e
    JOIN conceptos_venta cv ON cv.embarque_id = e.id
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
    JOIN conceptos_costo cc ON cc.embarque_id = e.id
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
  -- AUD-2: la conversión sólo se hace si hay TC; sin TC, no suma (no inventamos tasa).
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
      AND NOT m.tc_incompleto  -- AUD-2: no alertar margen sin TC completo
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
  facturas_saldo AS (
    SELECT f.id,
           f.total - COALESCE((
             SELECT SUM(p.monto_aplicado_factura)
             FROM pagos_factura p
             WHERE p.factura_id = f.id AND p.deleted_at IS NULL
           ), 0) AS saldo
    FROM facturas f
    WHERE f.organization_id = p_organization_id
      AND f.deleted_at IS NULL
      AND f.uuid_fiscal IS NOT NULL
      AND f.estado IN ('Emitida','Vencida','Parcialmente pagada')
  ),
  hall_cxc_vencida AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'cxc_vencida', 'severidad', 'critico',
      'detalle', 'Factura ' || f.numero || ' vencida hace ' || (CURRENT_DATE - f.fecha_vencimiento) || ' día(s); saldo ' || to_char(fs.saldo,'FM999,999,990.00') || ' ' || f.moneda::text,
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', (fs.saldo * CASE WHEN f.moneda::text = 'MXN' THEN 1 ELSE COALESCE(NULLIF(f.tipo_cambio,0), 1) END)
    ) AS h
    FROM facturas f
    JOIN facturas_saldo fs ON fs.id = f.id
    JOIN emb e ON e.id = f.embarque_id
    WHERE f.fecha_vencimiento IS NOT NULL
      AND f.fecha_vencimiento < (CURRENT_DATE - (v_dias_cxc_vencida || ' days')::interval)
      AND fs.saldo > 0.01
  ),
  hall_cxp_captura AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'cxp_por_capturar_estancada', 'severidad', 'alto',
      'detalle', 'Factura proveedor ' || COALESCE(pf.folio_proveedor,'(s/folio)') || ' de ' || COALESCE(pf.proveedor_nombre,'(s/n)') || ' en captura hace ' || EXTRACT(DAY FROM (now() - pf.created_at))::int || ' día(s)',
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', (pf.total * CASE WHEN pf.moneda::text = 'MXN' THEN 1 ELSE COALESCE(NULLIF(pf.tipo_cambio_usd,0), 1) END)
    ) AS h
    FROM proveedor_facturas pf
    JOIN emb e ON e.id = pf.embarque_id
    WHERE pf.organization_id = p_organization_id
      AND pf.deleted_at IS NULL
      AND pf.estado_captura = 'por_capturar'
      AND pf.created_at < now() - (v_dias_cxp_captura || ' days')::interval
  ),
  hall_cxp_vencida AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'cxp_vencida', 'severidad', 'critico',
      'detalle', 'CXP ' || COALESCE(pf.folio_proveedor,'(s/folio)') || ' de ' || COALESCE(pf.proveedor_nombre,'(s/n)') || ' vencida hace ' || (CURRENT_DATE - pf.fecha_vencimiento) || ' día(s) por ' || to_char(pf.total,'FM999,999,990.00') || ' ' || pf.moneda::text,
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', (pf.total * CASE WHEN pf.moneda::text = 'MXN' THEN 1 ELSE COALESCE(NULLIF(pf.tipo_cambio_usd,0), 1) END)
    ) AS h
    FROM proveedor_facturas pf
    JOIN emb e ON e.id = pf.embarque_id
    WHERE pf.organization_id = p_organization_id
      AND pf.deleted_at IS NULL
      AND pf.estado = 'Vigente'
      AND pf.fecha_vencimiento IS NOT NULL
      AND pf.fecha_vencimiento < (CURRENT_DATE - (v_dias_cxp_vencida || ' days')::interval)
  ),
  contenedores_incompletos AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta,
           COUNT(ec.id) AS n_incompletos
    FROM emb e
    JOIN embarque_contenedores ec ON ec.embarque_id = e.id AND ec.deleted_at IS NULL
    WHERE e.modo = 'Marítimo'
      AND COALESCE(e.tipo_carga::text, '') ILIKE 'FCL%'
      AND e.estado::text IN ('En Tránsito','En Aduana','Llegada','Arribo','Entregado')
      AND (ec.peso_kg IS NULL OR ec.peso_kg <= 0 OR ec.volumen_m3 IS NULL OR ec.volumen_m3 <= 0)
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  hall_contenedor_datos AS (
    SELECT jsonb_build_object(
      'embarque_id', ci.embarque_id, 'expediente', ci.expediente,
      'cliente_nombre', ci.cliente_nombre, 'modo', ci.modo::text, 'estado', ci.estado::text, 'eta', ci.eta,
      'regla', 'contenedor_datos_incompletos', 'severidad', 'alto',
      'detalle', ci.n_incompletos || ' contenedor(es) sin peso o volumen capturado',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM contenedores_incompletos ci
  ),
  contenedores_sin_fechas AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta,
           COUNT(ec.id) AS n_sin_fechas
    FROM emb e
    JOIN embarque_contenedores ec ON ec.embarque_id = e.id AND ec.deleted_at IS NULL
    WHERE e.estado::text IN ('Entregado','Cerrado')
      AND (ec.fecha_descarga IS NULL OR ec.fecha_devolucion IS NULL)
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  hall_contenedor_fechas AS (
    SELECT jsonb_build_object(
      'embarque_id', cf.embarque_id, 'expediente', cf.expediente,
      'cliente_nombre', cf.cliente_nombre, 'modo', cf.modo::text, 'estado', cf.estado::text, 'eta', cf.eta,
      'regla', 'contenedor_fechas_incompletas', 'severidad', 'medio',
      'detalle', cf.n_sin_fechas || ' contenedor(es) sin fecha de descarga o devolución',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM contenedores_sin_fechas cf
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
    UNION ALL SELECT h FROM hall_cxc_vencida
    UNION ALL SELECT h FROM hall_cxp_captura
    UNION ALL SELECT h FROM hall_cxp_vencida
    UNION ALL SELECT h FROM hall_contenedor_datos
    UNION ALL SELECT h FROM hall_contenedor_fechas
    UNION ALL SELECT h FROM hall_tipo_cambio_faltante
  )
  SELECT public._audit_embarques_agregar(
    (SELECT COALESCE(jsonb_agg(h), '[]'::jsonb) FROM todos),
    jsonb_build_object(
      'margen_minimo_pct', v_margen_min_pct,
      'dias_proforma_vencida', v_dias_prof_venc,
      'dias_huerfano', v_dias_huerfano,
      'dias_borrador_abandonado', v_dias_borrador_abandonado,
      'dias_cxc_vencida', v_dias_cxc_vencida,
      'dias_cxp_captura', v_dias_cxp_captura,
      'dias_cxp_vencida', v_dias_cxp_vencida
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$function$
 name:auditoria_embarques_org schema:public;
