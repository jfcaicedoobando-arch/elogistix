CREATE OR REPLACE FUNCTION public.proveedor_inteligencia(p_proveedor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_usd numeric;
  v_eur numeric;
  v_tipo text;
  v_scorecard jsonb;
  v_tendencia jsonb;
  v_comparativo jsonb;
  v_alertas jsonb;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  SELECT t.usd_mxn, t.eur_mxn INTO v_usd, v_eur FROM public.tc_dof_vigente(CURRENT_DATE) t;

  SELECT p.tipo::text INTO v_tipo
  FROM public.proveedores p
  WHERE p.id = p_proveedor_id AND p.organization_id = v_oid AND p.deleted_at IS NULL;

  IF v_tipo IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.proveedores p
    WHERE p.id = p_proveedor_id AND p.organization_id = v_oid AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_PROVEEDOR_INEXISTENTE: el proveedor no existe en tu organización' USING ERRCODE = '42501';
  END IF;

  -- ============ Scorecard ============
  WITH cc AS (
    SELECT c.id, c.concepto, c.monto, c.moneda::text AS moneda, c.created_at,
           c.monto * COALESCE(CASE c.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0) AS monto_mxn,
           e.expediente,
           COALESCE(NULLIF(e.puerto_origen, ''), NULLIF(e.aeropuerto_origen, ''), NULLIF(e.ciudad_origen, ''), '—') AS origen,
           COALESCE(NULLIF(e.puerto_destino, ''), NULLIF(e.aeropuerto_destino, ''), NULLIF(e.ciudad_destino, ''), '—') AS destino
    FROM public.conceptos_costo c
    LEFT JOIN public.embarques e ON e.id = c.embarque_id
    WHERE c.proveedor_id = p_proveedor_id AND c.organization_id = v_oid AND c.deleted_at IS NULL
  ),
  fact AS (
    SELECT pfc.concepto_costo_id,
           SUM(pfc.monto) AS facturado,
           MIN(pf.fecha_emision) AS primera_emision,
           MIN(pf.moneda::text) AS moneda_factura
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
      AND pfc.concepto_costo_id IS NOT NULL
    GROUP BY pfc.concepto_costo_id
  ),
  part AS (
    SELECT cc.*, f.facturado, f.primera_emision,
           COALESCE(f.facturado, 0) * COALESCE(CASE COALESCE(f.moneda_factura, cc.moneda) WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0) AS facturado_mxn
    FROM cc LEFT JOIN fact f ON f.concepto_costo_id = cc.id
  ),
  facs AS (
    SELECT COUNT(*)::int AS n,
           SUM(pf.total * COALESCE(CASE pf.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0)) AS total_mxn
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
  ),
  tops AS (
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'monto_mxn')::numeric DESC), '[]'::jsonb) AS top_conceptos
    FROM (
      SELECT jsonb_build_object('concepto', concepto, 'monto_mxn', ROUND(SUM(monto_mxn), 2), 'partidas', COUNT(*)::int) AS x,
             SUM(monto_mxn) AS ord
      FROM part GROUP BY concepto ORDER BY ord DESC LIMIT 5
    ) s
  ),
  rutas AS (
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'monto_mxn')::numeric DESC), '[]'::jsonb) AS top_rutas
    FROM (
      SELECT jsonb_build_object('ruta', origen || ' → ' || destino, 'monto_mxn', ROUND(SUM(monto_mxn), 2),
                                'embarques', COUNT(DISTINCT expediente)::int) AS x,
             SUM(monto_mxn) AS ord
      FROM part WHERE expediente IS NOT NULL GROUP BY origen, destino ORDER BY ord DESC LIMIT 5
    ) s
  )
  SELECT jsonb_build_object(
    'partidas_total', (SELECT COUNT(*)::int FROM part),
    'partidas_facturadas', (SELECT COUNT(*)::int FROM part WHERE facturado IS NOT NULL),
    'comprometido_mxn', (SELECT ROUND(COALESCE(SUM(monto_mxn), 0), 2) FROM part),
    'facturado_mxn', (SELECT ROUND(COALESCE(SUM(facturado_mxn), 0), 2) FROM part WHERE facturado IS NOT NULL),
    'comprometido_ligado_mxn', (SELECT ROUND(COALESCE(SUM(monto_mxn), 0), 2) FROM part WHERE facturado IS NOT NULL),
    'dias_facturacion_prom', (
      SELECT ROUND(AVG(GREATEST(primera_emision - created_at::date, 0))::numeric, 1)
      FROM part WHERE primera_emision IS NOT NULL
    ),
    'facturas_count', (SELECT n FROM facs),
    'ticket_promedio_mxn', (SELECT CASE WHEN n > 0 THEN ROUND(COALESCE(total_mxn, 0) / n, 2) ELSE NULL END FROM facs),
    'top_conceptos', (SELECT top_conceptos FROM tops),
    'top_rutas', (SELECT top_rutas FROM rutas)
  ) INTO v_scorecard;

  -- ============ Tendencia 12 meses ============
  WITH meses AS (
    SELECT to_char(d, 'YYYY-MM') AS mes, d::date AS ini, (d + interval '1 month')::date AS fin
    FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '11 months', date_trunc('month', CURRENT_DATE), interval '1 month') d
  ),
  comp AS (
    SELECT to_char(c.created_at, 'YYYY-MM') AS mes,
           SUM(c.monto * COALESCE(CASE c.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0)) AS monto
    FROM public.conceptos_costo c
    WHERE c.proveedor_id = p_proveedor_id AND c.organization_id = v_oid AND c.deleted_at IS NULL
    GROUP BY 1
  ),
  fac AS (
    SELECT to_char(pf.fecha_emision, 'YYYY-MM') AS mes,
           SUM(pf.total * COALESCE(CASE pf.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0)) AS monto
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
    GROUP BY 1
  ),
  pag AS (
    SELECT to_char(pp.fecha_pago, 'YYYY-MM') AS mes,
           SUM(pp.monto * COALESCE(CASE pp.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0)) AS monto
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada' AND pp.deleted_at IS NULL
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'mes', m.mes,
           'comprometido', ROUND(COALESCE(c.monto, 0), 2),
           'facturado', ROUND(COALESCE(f.monto, 0), 2),
           'pagado', ROUND(COALESCE(p.monto, 0), 2)
         ) ORDER BY m.mes), '[]'::jsonb)
  INTO v_tendencia
  FROM meses m
  LEFT JOIN comp c ON c.mes = m.mes
  LEFT JOIN fac f ON f.mes = m.mes
  LEFT JOIN pag p ON p.mes = m.mes;

  -- ============ Comparativo vs proveedores del mismo tipo ============
  WITH base AS (
    SELECT lower(btrim(c.concepto)) AS concepto_norm,
           c.concepto,
           c.moneda::text AS moneda,
           c.proveedor_id,
           c.monto
    FROM public.conceptos_costo c
    JOIN public.proveedores p ON p.id = c.proveedor_id
    WHERE c.organization_id = v_oid AND c.deleted_at IS NULL
      AND c.created_at >= CURRENT_DATE - interval '12 months'
      AND c.monto > 0
      AND p.deleted_at IS NULL
      AND p.tipo::text IS NOT DISTINCT FROM v_tipo
  ),
  propios AS (
    SELECT concepto_norm, MIN(concepto) AS concepto, moneda,
           AVG(monto) AS unitario, COUNT(*)::int AS ops
    FROM base WHERE proveedor_id = p_proveedor_id
    GROUP BY concepto_norm, moneda
  ),
  otros AS (
    SELECT concepto_norm, moneda, AVG(monto) AS unitario, COUNT(*)::int AS ops,
           COUNT(DISTINCT proveedor_id)::int AS proveedores
    FROM base WHERE proveedor_id <> p_proveedor_id
    GROUP BY concepto_norm, moneda
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'concepto', pr.concepto,
           'moneda', pr.moneda,
           'unitario_propio', ROUND(pr.unitario, 2),
           'ops_propias', pr.ops,
           'unitario_otros', ROUND(o.unitario, 2),
           'ops_otros', o.ops,
           'proveedores_comparados', o.proveedores
         ) ORDER BY pr.ops DESC), '[]'::jsonb)
  INTO v_comparativo
  FROM propios pr
  JOIN otros o ON o.concepto_norm = pr.concepto_norm AND o.moneda = pr.moneda
  WHERE pr.ops >= 1;

  -- ============ Alertas ============
  WITH cerrados_sin_factura AS (
    SELECT COUNT(*)::int AS n,
           ROUND(COALESCE(SUM(c.monto * COALESCE(CASE c.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0)), 0), 2) AS monto_mxn
    FROM public.conceptos_costo c
    JOIN public.embarques e ON e.id = c.embarque_id
    WHERE c.proveedor_id = p_proveedor_id AND c.organization_id = v_oid AND c.deleted_at IS NULL
      AND e.estado IN ('Cerrado', 'Entregado', 'Por liquidar')
      AND NOT EXISTS (
        SELECT 1 FROM public.proveedor_facturas_conceptos pfc
        JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
        WHERE pfc.concepto_costo_id = c.id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
      )
  ),
  saldos AS (
    SELECT pf.id, pf.fecha_vencimiento,
           (pf.total - COALESCE((
             SELECT SUM(pp.monto) FROM public.pagos_proveedor pp
             WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL
           ), 0)) * COALESCE(CASE pf.moneda::text WHEN 'USD' THEN v_usd WHEN 'EUR' THEN v_eur ELSE 1 END, 0) AS saldo_mxn
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado NOT IN ('Cancelada', 'Pagada')
  ),
  docs AS (
    SELECT
      COUNT(*) FILTER (WHERE d.fecha_vencimiento < CURRENT_DATE)::int AS vencidos,
      COUNT(*) FILTER (WHERE d.fecha_vencimiento >= CURRENT_DATE AND d.fecha_vencimiento <= CURRENT_DATE + 30)::int AS por_vencer
    FROM public.proveedor_documentos d
    WHERE d.proveedor_id = p_proveedor_id AND d.organization_id = v_oid
      AND d.deleted_at IS NULL AND d.fecha_vencimiento IS NOT NULL
  ),
  banco AS (
    SELECT p.origen_proveedor::text AS origen,
           (COALESCE(NULLIF(btrim(p.banco), ''), NULL) IS NULL) AS sin_banco,
           (COALESCE(NULLIF(btrim(p.clabe), ''), NULL) IS NULL) AS sin_clabe,
           (COALESCE(NULLIF(btrim(p.swift_bic), ''), NULLIF(btrim(p.iban), ''), NULLIF(btrim(p.aba_routing), '')) IS NULL) AS sin_ruta_intl,
           (COALESCE(NULLIF(btrim(p.beneficiario), ''), NULL) IS NULL) AS sin_beneficiario
    FROM public.proveedores p
    WHERE p.id = p_proveedor_id AND p.organization_id = v_oid
  )
  SELECT jsonb_build_object(
    'cerrados_sin_factura', jsonb_build_object('count', (SELECT n FROM cerrados_sin_factura), 'monto_mxn', (SELECT monto_mxn FROM cerrados_sin_factura)),
    'facturas_por_vencer', jsonb_build_object(
      'count', (SELECT COUNT(*)::int FROM saldos WHERE saldo_mxn > 0.005 AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),
      'monto_mxn', (SELECT ROUND(COALESCE(SUM(saldo_mxn), 0), 2) FROM saldos WHERE saldo_mxn > 0.005 AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)
    ),
    'facturas_vencidas', jsonb_build_object(
      'count', (SELECT COUNT(*)::int FROM saldos WHERE saldo_mxn > 0.005 AND fecha_vencimiento < CURRENT_DATE),
      'monto_mxn', (SELECT ROUND(COALESCE(SUM(saldo_mxn), 0), 2) FROM saldos WHERE saldo_mxn > 0.005 AND fecha_vencimiento < CURRENT_DATE)
    ),
    'saldo_pendiente_mxn', (SELECT ROUND(COALESCE(SUM(saldo_mxn), 0), 2) FROM saldos WHERE saldo_mxn > 0.005),
    'bancarios_incompletos', (
      SELECT CASE WHEN b.origen = 'Extranjero' THEN (b.sin_ruta_intl OR b.sin_beneficiario)
                  ELSE (b.sin_banco OR b.sin_clabe) END
      FROM banco b
    ),
    'documentos_vencidos', (SELECT vencidos FROM docs),
    'documentos_por_vencer', (SELECT por_vencer FROM docs)
  ) INTO v_alertas;

  RETURN jsonb_build_object(
    'tc', jsonb_build_object('usd_mxn', v_usd, 'eur_mxn', v_eur, 'faltante', (v_usd IS NULL OR v_eur IS NULL)),
    'tipo_proveedor', v_tipo,
    'scorecard', COALESCE(v_scorecard, '{}'::jsonb),
    'tendencia', COALESCE(v_tendencia, '[]'::jsonb),
    'comparativo', COALESCE(v_comparativo, '[]'::jsonb),
    'alertas', COALESCE(v_alertas, '{}'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_inteligencia(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_inteligencia(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_inteligencia(uuid) TO authenticated, service_role;