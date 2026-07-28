-- ============================================================================
-- B-033 · dashboard_stats: excluir Borrador de "activos" y evitar que se
-- muestre como "Confirmado" por derivar de ETD/ETA.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_hoy date := current_date;
  v_inicio_mes date := date_trunc('month', v_hoy)::date;
  v_fin_mes date := (date_trunc('month', v_hoy) + interval '1 month' - interval '1 day')::date;
  v_inicio_sig date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_fin_sig date := (date_trunc('month', v_hoy) + interval '2 months' - interval '1 day')::date;
  v_dias_libres int := 7;
BEGIN
  WITH embarques_base AS (
    SELECT e.id, e.expediente, e.cliente_nombre, e.cliente_id, e.modo::text, e.tipo::text,
           e.estado::text, e.etd, e.eta, e.operador,
           e.puerto_origen, e.puerto_destino,
           e.aeropuerto_origen, e.aeropuerto_destino,
           e.ciudad_origen, e.ciudad_destino, e.contenedor, e.created_at,
      CASE
        -- B-033 (v13.320.42): preservar Borrador para que no se cuente como Confirmado.
        WHEN e.estado = 'Borrador' THEN 'Borrador'
        WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Cerrado') THEN e.estado::text
        WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación' AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
          CASE
            WHEN v_hoy < e.etd THEN 'Confirmado'
            WHEN v_hoy >= e.etd AND v_hoy < e.eta THEN 'En Tránsito'
            WHEN v_hoy >= e.eta THEN 'Arribo'
            ELSE e.estado::text
          END
        ELSE e.estado::text
      END AS estado_real
    FROM embarques e
    WHERE (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
      AND e.deleted_at IS NULL
  ),
  profit AS (
    SELECT p.embarque_id, p.venta_usd, p.costo_usd
    FROM profit_por_embarque() p
  ),
  activos AS (
    SELECT * FROM embarques_base
    -- B-033: Borrador ya no cuenta como activo operativo.
    WHERE estado_real NOT IN ('Borrador','EIR','Cerrado','Cancelado')
  ),
  conteo AS (
    SELECT jsonb_build_object(
      'Confirmado', count(*) FILTER (WHERE estado_real = 'Confirmado'),
      'En Tránsito', count(*) FILTER (WHERE estado_real = 'En Tránsito'),
      'Arribo', count(*) FILTER (WHERE estado_real = 'Arribo'),
      'En Aduana', count(*) FILTER (WHERE estado_real = 'En Aduana'),
      'Entregado', count(*) FILTER (WHERE estado_real = 'Entregado')
    ) AS val
    FROM activos
  ),
  alertas_src AS (
    SELECT a.* FROM activos a
    WHERE a.estado_real = 'Arribo' AND a.eta IS NOT NULL AND (v_hoy - a.eta) >= v_dias_libres
    ORDER BY (v_hoy - a.eta) DESC
    LIMIT 15
  ),
  alertas AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', a.id, 'expediente', a.expediente, 'cliente_nombre', a.cliente_nombre,
        'modo', a.modo, 'tipo', a.tipo, 'estado', a.estado, 'estadoReal', a.estado_real,
        'etd', a.etd, 'eta', a.eta, 'operador', a.operador,
        'puerto_origen', a.puerto_origen, 'puerto_destino', a.puerto_destino,
        'aeropuerto_origen', a.aeropuerto_origen, 'aeropuerto_destino', a.aeropuerto_destino,
        'ciudad_origen', a.ciudad_origen, 'ciudad_destino', a.ciudad_destino,
        'contenedor', a.contenedor, 'created_at', a.created_at,
        'diasDesdeEta', (v_hoy - a.eta),
        'diasDemora', (v_hoy - a.eta) - v_dias_libres
      )
    ) AS val
    FROM alertas_src a
  ),
  proximos_src AS (
    SELECT a.* FROM activos a
    WHERE a.estado_real = 'En Tránsito' AND a.eta IS NOT NULL
      AND (a.eta - v_hoy) >= 0 AND (a.eta - v_hoy) <= 7
    ORDER BY (a.eta - v_hoy) ASC
    LIMIT 15
  ),
  proximos AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', a.id, 'expediente', a.expediente, 'cliente_nombre', a.cliente_nombre,
        'modo', a.modo, 'tipo', a.tipo, 'estado', a.estado, 'estadoReal', a.estado_real,
        'etd', a.etd, 'eta', a.eta, 'operador', a.operador,
        'puerto_origen', a.puerto_origen, 'puerto_destino', a.puerto_destino,
        'aeropuerto_origen', a.aeropuerto_origen, 'aeropuerto_destino', a.aeropuerto_destino,
        'ciudad_origen', a.ciudad_origen, 'ciudad_destino', a.ciudad_destino,
        'contenedor', a.contenedor, 'created_at', a.created_at,
        'diasRestantes', (a.eta - v_hoy)
      )
    ) AS val
    FROM proximos_src a
  ),
  profit_este_mes_src AS (
    SELECT eb.*, p.venta_usd, p.costo_usd
    FROM activos eb
    LEFT JOIN profit p ON p.embarque_id = eb.id
    WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_mes AND eb.eta <= v_fin_mes
      AND (COALESCE(p.venta_usd, 0) > 0 OR COALESCE(p.costo_usd, 0) > 0)
    ORDER BY (COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0)) DESC
    LIMIT 30
  ),
  profit_este_mes AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', eb.id, 'expediente', eb.expediente, 'cliente_nombre', eb.cliente_nombre,
        'modo', eb.modo, 'tipo', eb.tipo, 'estado', eb.estado, 'estadoReal', eb.estado_real,
        'etd', eb.etd, 'eta', eb.eta, 'operador', eb.operador,
        'puerto_origen', eb.puerto_origen, 'puerto_destino', eb.puerto_destino,
        'aeropuerto_origen', eb.aeropuerto_origen, 'aeropuerto_destino', eb.aeropuerto_destino,
        'ciudad_origen', eb.ciudad_origen, 'ciudad_destino', eb.ciudad_destino,
        'contenedor', eb.contenedor, 'created_at', eb.created_at,
        'ventaUSD', COALESCE(eb.venta_usd, 0),
        'costoUSD', COALESCE(eb.costo_usd, 0),
        'profit', COALESCE(eb.venta_usd, 0) - COALESCE(eb.costo_usd, 0),
        'margen', CASE WHEN COALESCE(eb.venta_usd, 0) > 0
          THEN round(((COALESCE(eb.venta_usd, 0) - COALESCE(eb.costo_usd, 0)) / eb.venta_usd * 100)::numeric, 1)
          ELSE 0 END
      )
    ) AS val
    FROM profit_este_mes_src eb
  ),
  arribos_mes AS (
    SELECT jsonb_build_object(
      'total', count(*),
      'yaLlegaron', count(*) FILTER (WHERE eb.estado_real IN ('Arribo','En Aduana','Entregado','EIR','Cerrado')),
      'enCamino', count(*) FILTER (WHERE eb.estado_real IN ('Confirmado','En Tránsito')),
      'profitUSD', COALESCE(sum(COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0)), 0)
    ) AS val
    FROM embarques_base eb
    LEFT JOIN profit p ON p.embarque_id = eb.id
    WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_mes AND eb.eta <= v_fin_mes
      AND eb.estado_real <> 'Borrador'
  ),
  mes_sig_src AS (
    SELECT eb.*, p.venta_usd, p.costo_usd
    FROM activos eb
    LEFT JOIN profit p ON p.embarque_id = eb.id
    WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_sig AND eb.eta <= v_fin_sig
    ORDER BY eb.eta ASC
    LIMIT 30
  ),
  mes_sig AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', eb.id, 'expediente', eb.expediente, 'cliente_nombre', eb.cliente_nombre,
        'modo', eb.modo, 'tipo', eb.tipo, 'estado', eb.estado, 'estadoReal', eb.estado_real,
        'etd', eb.etd, 'eta', eb.eta, 'operador', eb.operador,
        'puerto_origen', eb.puerto_origen, 'puerto_destino', eb.puerto_destino,
        'aeropuerto_origen', eb.aeropuerto_origen, 'aeropuerto_destino', eb.aeropuerto_destino,
        'ciudad_origen', eb.ciudad_origen, 'ciudad_destino', eb.ciudad_destino,
        'contenedor', eb.contenedor, 'created_at', eb.created_at,
        'ventaUSD', COALESCE(eb.venta_usd, 0),
        'costoUSD', COALESCE(eb.costo_usd, 0)
      )
    ) AS val
    FROM mes_sig_src eb
  ),
  resumen_sig AS (
    SELECT jsonb_build_object(
      'total', count(*),
      'ventaUSD', COALESCE(sum(COALESCE(p.venta_usd, 0)), 0),
      'costoUSD', COALESCE(sum(COALESCE(p.costo_usd, 0)), 0)
    ) AS val
    FROM activos eb
    LEFT JOIN profit p ON p.embarque_id = eb.id
    WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_sig AND eb.eta <= v_fin_sig
  ),
  cargas_cliente AS (
    SELECT jsonb_agg(x ORDER BY (x->>'total')::int DESC) AS val
    FROM (
      SELECT jsonb_build_object(
        'clienteId', cliente_id,
        'clienteNombre', cliente_nombre,
        'total', count(*),
        'desglose', jsonb_build_object(
          'Confirmado', count(*) FILTER (WHERE estado_real = 'Confirmado'),
          'En Tránsito', count(*) FILTER (WHERE estado_real = 'En Tránsito'),
          'Arribo', count(*) FILTER (WHERE estado_real = 'Arribo'),
          'En Aduana', count(*) FILTER (WHERE estado_real = 'En Aduana'),
          'Entregado', count(*) FILTER (WHERE estado_real = 'Entregado')
        )
      ) AS x
      FROM activos
      WHERE cliente_id IS NOT NULL
      GROUP BY cliente_id, cliente_nombre
      ORDER BY count(*) DESC
      LIMIT 10
    ) sub
  )
  SELECT jsonb_build_object(
    'totalActivos', (SELECT count(*) FROM activos),
    'conteoPorEstado', COALESCE((SELECT val FROM conteo), '{}'::jsonb),
    'alertasDemora', COALESCE((SELECT val FROM alertas), '[]'::jsonb),
    'proximosArribos', COALESCE((SELECT val FROM proximos), '[]'::jsonb),
    'profitArribosEsteMes', COALESCE((SELECT val FROM profit_este_mes), '[]'::jsonb),
    'arribosEsteMes', COALESCE((SELECT val FROM arribos_mes), '{}'::jsonb),
    'embarquesMesSiguiente', COALESCE((SELECT val FROM mes_sig), '[]'::jsonb),
    'resumenMesSiguiente', COALESCE((SELECT val FROM resumen_sig), '{}'::jsonb),
    'cargasPorCliente', COALESCE((SELECT val FROM cargas_cliente), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO service_role;

-- ============================================================================
-- B-022 · pnl_financiero_embarque: emitir por_concepto / por_concepto_costo
-- (antes las tablas del detalle del P&L siempre decían "Sin datos").
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque(_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tc_usd numeric; _tc_eur numeric; _org uuid;
  _has_pf boolean; _has_seg boolean;
  _estado_costos text;
  _base jsonb;
BEGIN
  SELECT COALESCE(tipo_cambio_usd,0), COALESCE(tipo_cambio_eur,0), organization_id
    INTO _tc_usd, _tc_eur, _org
  FROM public.embarques WHERE id = _embarque_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque % no encontrado', _embarque_id;
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND _org <> public.current_user_org_id() THEN
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
           moneda::text AS moneda, coalesce(total,0)::numeric AS monto
    FROM public.conceptos_venta
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  cc AS (
    SELECT lower(trim(coalesce(concepto,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(monto,0)::numeric AS monto,
           proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  seg AS (
    SELECT 'seguro de carga'::text AS concepto, moneda::text AS moneda,
           coalesce(prima,0)::numeric AS monto,
           NULL::uuid AS proveedor_id, aseguradora AS proveedor_nombre
    FROM public.seguros_embarque
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  f AS (
    SELECT id, coalesce(subtotal,0)::numeric AS subtotal, moneda::text AS moneda,
           estado::text AS estado, total::numeric AS total
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
    SELECT f.id, f.moneda, f.estado,
           f.subtotal - coalesce((SELECT sum(monto) FROM fnc WHERE factura_id = f.id),0) AS monto
    FROM f
  ),
  f_saldo AS (
    SELECT f.id, f.moneda, f.estado, public.saldo_factura(f.id) AS saldo FROM f
  ),
  pf AS (
    SELECT id, proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           coalesce(NULLIF(total,0), subtotal, 0)::numeric AS total,
           moneda::text AS moneda, estado::text AS estado
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
    SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, pf.moneda, pf.estado,
           pf.total - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0) AS monto
    FROM pf
  ),
  pf_saldo AS (
    SELECT pf.id, pf.moneda, pf.estado,
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
      (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM f_neto) AS venta_real_mxn,
      (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM pf_neto)
        + (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM seg) AS costo_real_mxn
  )
  SELECT jsonb_build_object(
    'embarque_id', _embarque_id,
    'tipo_cambio_usd', _tc_usd,
    'tipo_cambio_eur', _tc_eur,
    'estado_costos', _estado_costos,
    'venta', jsonb_build_object(
      'presupuestada_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cv),
      'real_mxn', t.venta_real_mxn,
      'pdte_cobro_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(saldo, moneda, _tc_usd, _tc_eur)),0)
                          FROM f_saldo WHERE estado IN ('Emitida','Vencida','Parcialmente pagada','Por timbrar'))
    ),
    'costo', jsonb_build_object(
      'presupuestado_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cc),
      'real_mxn', t.costo_real_mxn,
      'pdte_pago_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(saldo, moneda, _tc_usd, _tc_eur)),0)
                         FROM pf_saldo WHERE estado IN ('Vigente','Parcial','Por vencer','Vencida'))
    ),
    'utilidad_mxn', CASE
      WHEN _estado_costos = 'incompleto' THEN NULL
      ELSE round((t.venta_real_mxn - t.costo_real_mxn)::numeric, 2)
    END,
    -- B-022 (v13.320.42): desglose por concepto que antes no se emitía.
    -- Se agrega por descripción normalizada; consumido por las tablas
    -- "Ingresos/Costos por concepto" del componente P&L del embarque.
    'por_concepto', (
      SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY (x.presupuestada_mxn + x.real_mxn) DESC), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup),0) AS presupuestada_mxn,
               coalesce(sum(real),0) AS real_mxn
        FROM (
          SELECT concepto,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup,
                 0::numeric AS real FROM cv
          UNION ALL
          SELECT lower(trim(coalesce(NULLIF(fc.descripcion,''), '(sin concepto)'))),
                 0::numeric,
                 public.convertir_a_mxn(coalesce(fc.subtotal,0), f.moneda, _tc_usd, _tc_eur)
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
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup,
                 0::numeric AS real FROM cc
          UNION ALL
          -- Facturas de proveedor: intentar mapear por concepto individual;
          -- si no hay conceptos, cae a "(factura completa)".
          SELECT lower(trim(coalesce(NULLIF(pfc.descripcion,''), '(sin concepto)'))),
                 0::numeric,
                 public.convertir_a_mxn(coalesce(pfc.subtotal, pfc.total, 0), pf.moneda, _tc_usd, _tc_eur)
          FROM public.proveedor_facturas_conceptos pfc
          JOIN pf ON pf.id = pfc.proveedor_factura_id
          UNION ALL
          -- Fallback: facturas de proveedor sin conceptos van a "(factura completa)"
          SELECT '(factura completa)'::text,
                 0::numeric,
                 public.convertir_a_mxn(pf_neto.monto, pf_neto.moneda, _tc_usd, _tc_eur)
          FROM pf_neto
          WHERE NOT EXISTS (SELECT 1 FROM public.proveedor_facturas_conceptos pfc
                              WHERE pfc.proveedor_factura_id = pf_neto.id)
          UNION ALL
          SELECT concepto, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)
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
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn,
                 0::numeric AS real_mxn, 0 AS facturas_count FROM cc
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1 FROM pf_neto
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1 FROM seg
        ) u GROUP BY proveedor_id, proveedor_nombre
      ) x
    )
  ) INTO _base FROM totales t;

  RETURN _base;
END;
$$;

REVOKE ALL ON FUNCTION public.pnl_financiero_embarque(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO service_role;

-- ============================================================================
-- B-036 · cotizaciones_listado: fallback desde conceptos cuando el subtotal
-- almacenado quedó en cero por dato legado. La moneda dominante también se
-- recalcula del mismo agregado.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cotizaciones_listado(
  p_organization_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT NULL::text,
  p_estado text DEFAULT NULL::text,
  p_modo text DEFAULT NULL::text,
  p_cliente_id uuid DEFAULT NULL::uuid,
  p_fecha_desde date DEFAULT NULL::date,
  p_fecha_hasta date DEFAULT NULL::date,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid, folio text, cliente_id uuid, cliente_nombre text,
  modo modo_transporte, origen text, destino text, subtotal numeric,
  moneda moneda, estado estado_cotizacion, fecha_vigencia date,
  created_at timestamp with time zone, descripcion_mercancia text,
  embarques_vinculados bigint, total_count bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT c.*
    FROM cotizaciones c
    WHERE c.deleted_at IS NULL
      AND ( p_organization_id IS NULL OR c.organization_id = p_organization_id )
      AND ( p_search IS NULL OR p_search = '' OR
            c.folio ILIKE '%' || p_search || '%' OR
            c.cliente_nombre ILIKE '%' || p_search || '%' OR
            c.descripcion_mercancia ILIKE '%' || p_search || '%' )
      AND ( p_estado IS NULL OR c.estado = p_estado::estado_cotizacion )
      AND ( p_modo IS NULL OR c.modo = p_modo::modo_transporte )
      AND ( p_cliente_id IS NULL OR c.cliente_id = p_cliente_id )
      AND ( p_fecha_desde IS NULL OR c.created_at >= p_fecha_desde )
      AND ( p_fecha_hasta IS NULL OR c.created_at <= (p_fecha_hasta + interval '1 day') )
  ),
  counted AS (
    SELECT f.*, count(*) OVER ()::bigint AS total_count
    FROM filtered f
    ORDER BY f.created_at DESC
    OFFSET p_offset LIMIT p_limit
  ),
  emb_agg AS (
    SELECT e.cotizacion_id, count(*)::bigint AS embarques_vinculados
    FROM embarques e
    WHERE e.cotizacion_id IN (SELECT id FROM counted)
    GROUP BY e.cotizacion_id
  )
  SELECT c.id, c.folio, c.cliente_id, c.cliente_nombre, c.modo, c.origen, c.destino,
         -- B-036 (v13.320.42): si el subtotal quedó en 0 (legado o guardado sin
         -- recalcular), recomponerlo desde los conceptos reales. Igual con la
         -- moneda dominante (la más cara del set).
         CASE
           WHEN COALESCE(c.subtotal, 0) > 0 THEN c.subtotal
           ELSE COALESCE((
             SELECT sum(cc.precio_venta)
             FROM cotizacion_costos cc
             WHERE cc.cotizacion_id = c.id AND cc.deleted_at IS NULL
           ), 0)
         END AS subtotal,
         CASE
           WHEN COALESCE(c.subtotal, 0) > 0 THEN c.moneda
           ELSE COALESCE((
             SELECT cc.moneda::moneda
             FROM cotizacion_costos cc
             WHERE cc.cotizacion_id = c.id AND cc.deleted_at IS NULL
             GROUP BY cc.moneda
             ORDER BY sum(cc.precio_venta) DESC NULLS LAST
             LIMIT 1
           ), c.moneda)
         END AS moneda,
         c.estado, c.fecha_vigencia, c.created_at, c.descripcion_mercancia,
         COALESCE(ea.embarques_vinculados, 0),
         c.total_count
  FROM counted c
  LEFT JOIN emb_agg ea ON ea.cotizacion_id = c.id
  ORDER BY c.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.cotizaciones_listado(uuid,text,text,text,uuid,date,date,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotizaciones_listado(uuid,text,text,text,uuid,date,date,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cotizaciones_listado(uuid,text,text,text,uuid,date,date,integer,integer) TO service_role;
