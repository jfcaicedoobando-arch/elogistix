-- ============================================================================
-- AUDITORÍA — FASE 3
-- ============================================================================

-- 1) Snooze en auditoria_revisiones -------------------------------------------
ALTER TABLE public.auditoria_revisiones
  ADD COLUMN IF NOT EXISTS snoozed_until date,
  ADD COLUMN IF NOT EXISTS snooze_motivo text;

-- 2) Comentarios por hallazgo --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auditoria_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  revision_id uuid NOT NULL REFERENCES public.auditoria_revisiones(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  autor_email text NOT NULL DEFAULT '',
  contenido text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_comentarios_revision
  ON public.auditoria_comentarios(revision_id, created_at DESC);

ALTER TABLE public.auditoria_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read auditoria_comentarios" ON public.auditoria_comentarios;
CREATE POLICY "Tenant read auditoria_comentarios"
  ON public.auditoria_comentarios FOR SELECT
  TO authenticated
  USING (
    organization_id = current_user_org_id()
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "Tenant write auditoria_comentarios" ON public.auditoria_comentarios;
CREATE POLICY "Tenant write auditoria_comentarios"
  ON public.auditoria_comentarios FOR ALL
  TO authenticated
  USING (
    (
      organization_id = current_user_org_id()
      AND (
        has_org_role(auth.uid(), organization_id, 'admin'::app_role)
        OR has_org_role(auth.uid(), organization_id, 'operador'::app_role)
      )
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    (
      organization_id = current_user_org_id()
      AND autor_id = auth.uid()
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 3) Snapshots históricos ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auditoria_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  total_hallazgos int NOT NULL DEFAULT 0,
  total_pendientes int NOT NULL DEFAULT 0,
  criticos int NOT NULL DEFAULT 0,
  altos int NOT NULL DEFAULT 0,
  medios int NOT NULL DEFAULT 0,
  por_regla jsonb NOT NULL DEFAULT '{}'::jsonb,
  score int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_auditoria_snapshots_org_fecha
  ON public.auditoria_snapshots(organization_id, fecha DESC);

ALTER TABLE public.auditoria_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read auditoria_snapshots" ON public.auditoria_snapshots;
CREATE POLICY "Tenant read auditoria_snapshots"
  ON public.auditoria_snapshots FOR SELECT
  TO authenticated
  USING (
    organization_id = current_user_org_id()
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "Tenant write auditoria_snapshots" ON public.auditoria_snapshots;
CREATE POLICY "Tenant write auditoria_snapshots"
  ON public.auditoria_snapshots FOR ALL
  TO authenticated
  USING (
    (
      organization_id = current_user_org_id()
      AND (
        has_org_role(auth.uid(), organization_id, 'admin'::app_role)
        OR has_org_role(auth.uid(), organization_id, 'operador'::app_role)
      )
    )
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    organization_id = current_user_org_id()
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 4) RPC ampliada con reglas financieras --------------------------------------
CREATE OR REPLACE FUNCTION public.auditoria_embarques_org()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_margen_min_pct numeric;
  v_dias_prof_venc int;
  v_dias_huerfano int;
BEGIN
  SELECT COALESCE(NULLIF((valor #>> '{}'), '')::numeric, 5)
  INTO v_margen_min_pct
  FROM configuracion
  WHERE categoria = 'auditoria' AND clave = 'margen_minimo_pct'
  LIMIT 1;
  v_margen_min_pct := COALESCE(v_margen_min_pct, 5);

  SELECT COALESCE(NULLIF((valor #>> '{}'), '')::int, 30)
  INTO v_dias_prof_venc
  FROM configuracion
  WHERE categoria = 'auditoria' AND clave = 'dias_proforma_vencida'
  LIMIT 1;
  v_dias_prof_venc := COALESCE(v_dias_prof_venc, 30);

  SELECT COALESCE(NULLIF((valor #>> '{}'), '')::int, 5)
  INTO v_dias_huerfano
  FROM configuracion
  WHERE categoria = 'auditoria' AND clave = 'dias_huerfano'
  LIMIT 1;
  v_dias_huerfano := COALESCE(v_dias_huerfano, 5);

  WITH
  emb AS (
    SELECT id, expediente, cliente_nombre, modo, estado, etd, eta,
           fecha_llegada_real, tipo_servicio, operador,
           tipo_cambio_usd, tipo_cambio_eur, fecha_creacion
    FROM embarques
    WHERE estado <> 'Cancelado'
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
      'detalle', 'Embarque con pérdida: ' || to_char(m.utilidad_mxn,'FM999,999,990.00') || ' MXN ('
                 || COALESCE(to_char(m.margen_pct,'FM990.0') || '%','—') || ')',
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', m.utilidad_mxn
    ) AS h
    FROM margenes m
    WHERE m.venta_mxn > 0 AND m.costo_mxn > 0 AND m.utilidad_mxn < 0
  ),
  hall_margen_bajo AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'margen_bajo', 'severidad', 'alto',
      'detalle', 'Margen ' || to_char(m.margen_pct,'FM990.0') || '% por debajo del mínimo ('
                 || to_char(v_margen_min_pct,'FM990.0') || '%) — utilidad '
                 || to_char(m.utilidad_mxn,'FM999,999,990.00') || ' MXN',
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', m.utilidad_mxn
    ) AS h
    FROM margenes m
    WHERE m.venta_mxn > 0 AND m.costo_mxn > 0
      AND m.margen_pct IS NOT NULL
      AND m.margen_pct >= 0 AND m.margen_pct < v_margen_min_pct
  ),
  hall_venta_sin_costo AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'venta_sin_costo', 'severidad', 'alto',
      'detalle', 'Embarque con ventas (' || to_char(m.venta_mxn,'FM999,999,990.00') || ' MXN) sin costos cargados',
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', m.venta_mxn
    ) AS h
    FROM margenes m
    WHERE m.n_ventas > 0 AND m.n_costos = 0
  ),
  hall_costo_sin_venta AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'costo_sin_venta', 'severidad', 'medio',
      'detalle', 'Embarque cerrado con costos (' || to_char(m.costo_mxn,'FM999,999,990.00') || ' MXN) sin venta facturable',
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', m.costo_mxn
    ) AS h
    FROM margenes m
    WHERE m.estado IN ('Entregado','Cerrado')
      AND m.n_costos > 0 AND m.n_ventas = 0
  ),
  hall_proforma_vencida AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'proforma_vencida', 'severidad', 'alto',
      'detalle', 'Proforma ' || p.numero || ' emitida hace '
                 || (CURRENT_DATE - p.fecha_emision) || ' días sin factura ('
                 || to_char(COALESCE(NULLIF(p.total_mxn,0), p.total_usd),'FM999,999,990.00')
                 || ' ' || CASE WHEN p.total_mxn > 0 THEN 'MXN' ELSE 'USD' END || ')',
      'documentos_faltantes', '[]'::jsonb,
      'monto_mxn', COALESCE(NULLIF(p.total_mxn,0), p.total_usd * COALESCE(NULLIF(e.tipo_cambio_usd,0),17.5))
    ) AS h
    FROM proformas p
    JOIN emb e ON e.id = p.embarque_id
    WHERE p.factura_id IS NULL
      AND p.estado_proforma <> 'cancelada'
      AND (CURRENT_DATE - p.fecha_emision) > v_dias_prof_venc
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
      'detalle',
        CASE
          WHEN COALESCE(e.operador,'') = '' THEN 'Embarque activo sin operador asignado'
          ELSE 'Embarque sin movimientos en bitácora hace > ' || v_dias_huerfano || ' días (operador: ' || e.operador || ')'
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
$$;

GRANT EXECUTE ON FUNCTION public.auditoria_embarques_org() TO authenticated;

-- 5) RPC para capturar snapshot diario por organización -----------------------
CREATE OR REPLACE FUNCTION public.auditoria_capturar_snapshot(p_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_pend int := 0;
  v_crit int := 0;
  v_alto int := 0;
  v_med int := 0;
  v_score int := 100;
  v_id uuid;
BEGIN
  IF NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR is_org_admin(auth.uid(), p_organization_id)
    OR has_org_role(auth.uid(), p_organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), p_organization_id, 'operador'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado para capturar snapshot de esta organización';
  END IF;

  -- Calcular agregados directos por org (versión simplificada del RPC principal,
  -- contando hallazgos críticos sin recalcular toda la lógica financiera).
  SELECT COUNT(*) INTO v_total
  FROM auditoria_revisiones
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_pend
  FROM auditoria_revisiones
  WHERE organization_id = p_organization_id
    AND estado_revision <> 'revisado';

  -- Para criticos/altos/medios necesitamos llamar la RPC principal — sólo
  -- funciona si el caller pertenece a la org. Si no, dejamos en cero (caso
  -- super_admin sin pertenencia).
  IF current_user_org_id() = p_organization_id THEN
    SELECT
      COALESCE((r->'por_severidad'->>'critico')::int, 0),
      COALESCE((r->'por_severidad'->>'alto')::int, 0),
      COALESCE((r->'por_severidad'->>'medio')::int, 0),
      COALESCE((r->>'total_hallazgos')::int, 0)
    INTO v_crit, v_alto, v_med, v_total
    FROM (SELECT auditoria_embarques_org() AS r) x;
  END IF;

  v_score := GREATEST(0, 100 - LEAST(100, (v_crit * 5 + v_alto * 2 + v_med * 1) * 2));

  INSERT INTO auditoria_snapshots (
    organization_id, fecha, total_hallazgos, total_pendientes,
    criticos, altos, medios, score, por_regla
  ) VALUES (
    p_organization_id, CURRENT_DATE, v_total, GREATEST(0, v_pend),
    v_crit, v_alto, v_med, v_score, '{}'::jsonb
  )
  ON CONFLICT (organization_id, fecha) DO UPDATE SET
    total_hallazgos  = EXCLUDED.total_hallazgos,
    total_pendientes = EXCLUDED.total_pendientes,
    criticos = EXCLUDED.criticos,
    altos    = EXCLUDED.altos,
    medios   = EXCLUDED.medios,
    score    = EXCLUDED.score
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auditoria_capturar_snapshot(uuid) TO authenticated;