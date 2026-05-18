-- Profit homologado a MXN: corrige profit_por_embarque() para considerar
-- conceptos en MXN/USD/EUR, usando el TC guardado en cada embarque.
-- También extiende dashboard_summary y dashboard_details para exponer
-- profitMXN, ventaMXN, costoMXN y desglose por moneda.

DROP FUNCTION IF EXISTS public.profit_por_embarque();

CREATE OR REPLACE FUNCTION public.profit_por_embarque()
RETURNS TABLE(
  embarque_id uuid,
  venta_mxn numeric,
  costo_mxn numeric,
  venta_mxn_from_usd numeric,
  costo_mxn_from_usd numeric,
  venta_mxn_from_eur numeric,
  costo_mxn_from_eur numeric,
  venta_mxn_native numeric,
  costo_mxn_native numeric,
  venta_usd numeric,
  costo_usd numeric,
  tipo_cambio_usd numeric,
  tipo_cambio_eur numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH ventas AS (
    SELECT
      cv.embarque_id,
      SUM(CASE WHEN cv.moneda = 'USD' THEN cv.total ELSE 0 END) AS venta_usd_raw,
      SUM(CASE WHEN cv.moneda = 'EUR' THEN cv.total ELSE 0 END) AS venta_eur_raw,
      SUM(CASE WHEN cv.moneda = 'MXN' THEN cv.total ELSE 0 END) AS venta_mxn_raw
    FROM conceptos_venta cv
    WHERE cv.deleted_at IS NULL
    GROUP BY cv.embarque_id
  ),
  costos AS (
    SELECT
      cc.embarque_id,
      SUM(CASE WHEN cc.moneda = 'USD' THEN cc.monto ELSE 0 END) AS costo_usd_raw,
      SUM(CASE WHEN cc.moneda = 'EUR' THEN cc.monto ELSE 0 END) AS costo_eur_raw,
      SUM(CASE WHEN cc.moneda = 'MXN' THEN cc.monto ELSE 0 END) AS costo_mxn_raw
    FROM conceptos_costo cc
    WHERE cc.deleted_at IS NULL
    GROUP BY cc.embarque_id
  )
  SELECT
    e.id AS embarque_id,
    -- Totales homologados en MXN
    COALESCE(v.venta_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0)
      + COALESCE(v.venta_eur_raw, 0) * COALESCE(e.tipo_cambio_eur, 0)
      + COALESCE(v.venta_mxn_raw, 0) AS venta_mxn,
    COALESCE(c.costo_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0)
      + COALESCE(c.costo_eur_raw, 0) * COALESCE(e.tipo_cambio_eur, 0)
      + COALESCE(c.costo_mxn_raw, 0) AS costo_mxn,
    -- Desglose por moneda origen (en MXN)
    COALESCE(v.venta_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0) AS venta_mxn_from_usd,
    COALESCE(c.costo_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0) AS costo_mxn_from_usd,
    COALESCE(v.venta_eur_raw, 0) * COALESCE(e.tipo_cambio_eur, 0) AS venta_mxn_from_eur,
    COALESCE(c.costo_eur_raw, 0) * COALESCE(e.tipo_cambio_eur, 0) AS costo_mxn_from_eur,
    COALESCE(v.venta_mxn_raw, 0) AS venta_mxn_native,
    COALESCE(c.costo_mxn_raw, 0) AS costo_mxn_native,
    -- Compat: venta/costo en USD nativo (solo conceptos USD)
    COALESCE(v.venta_usd_raw, 0) AS venta_usd,
    COALESCE(c.costo_usd_raw, 0) AS costo_usd,
    COALESCE(e.tipo_cambio_usd, 0) AS tipo_cambio_usd,
    COALESCE(e.tipo_cambio_eur, 0) AS tipo_cambio_eur
  FROM embarques e
  LEFT JOIN ventas v ON v.embarque_id = e.id
  LEFT JOIN costos c ON c.embarque_id = e.id
  WHERE e.deleted_at IS NULL
    AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (
      COALESCE(v.venta_usd_raw, 0) > 0 OR COALESCE(v.venta_eur_raw, 0) > 0 OR COALESCE(v.venta_mxn_raw, 0) > 0
      OR COALESCE(c.costo_usd_raw, 0) > 0 OR COALESCE(c.costo_eur_raw, 0) > 0 OR COALESCE(c.costo_mxn_raw, 0) > 0
    );
$function$;

-- ============================================================================
-- dashboard_summary: añade MXN al bloque arribosEsteMes y resumenMesSiguiente
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoy date := current_date;
  v_inicio_mes date := date_trunc('month', v_hoy)::date;
  v_fin_mes date := (date_trunc('month', v_hoy) + interval '1 month' - interval '1 day')::date;
  v_inicio_sig date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_fin_sig date := (date_trunc('month', v_hoy) + interval '2 months' - interval '1 day')::date;
BEGIN
  RETURN (
    WITH embarques_base AS (
      SELECT e.id, e.estado::text, e.modo, e.tipo, e.etd, e.eta,
        CASE
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
    ),
    profit AS (SELECT * FROM profit_por_embarque()),
    activos AS (SELECT * FROM embarques_base WHERE estado_real NOT IN ('EIR','Cerrado','Cancelado')),
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
    arribos_mes AS (
      SELECT jsonb_build_object(
        'total', count(*),
        'yaLlegaron', count(*) FILTER (WHERE eb.estado_real IN ('Arribo','En Aduana','Entregado','EIR','Cerrado')),
        'enCamino', count(*) FILTER (WHERE eb.estado_real IN ('Confirmado','En Tránsito')),
        'ventaMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0)), 0),
        'costoMXN', COALESCE(sum(COALESCE(p.costo_mxn, 0)), 0),
        'profitMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0) - COALESCE(p.costo_mxn, 0)), 0),
        'ventaMxnFromUsd', COALESCE(sum(COALESCE(p.venta_mxn_from_usd, 0)), 0),
        'costoMxnFromUsd', COALESCE(sum(COALESCE(p.costo_mxn_from_usd, 0)), 0),
        'ventaMxnFromEur', COALESCE(sum(COALESCE(p.venta_mxn_from_eur, 0)), 0),
        'costoMxnFromEur', COALESCE(sum(COALESCE(p.costo_mxn_from_eur, 0)), 0),
        'ventaMxnNative', COALESCE(sum(COALESCE(p.venta_mxn_native, 0)), 0),
        'costoMxnNative', COALESCE(sum(COALESCE(p.costo_mxn_native, 0)), 0),
        'profitUSD', COALESCE(sum(COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0)), 0)
      ) AS val
      FROM embarques_base eb
      LEFT JOIN profit p ON p.embarque_id = eb.id
      WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_mes AND eb.eta <= v_fin_mes
    ),
    resumen_sig AS (
      SELECT jsonb_build_object(
        'total', count(*),
        'ventaUSD', COALESCE(sum(COALESCE(p.venta_usd, 0)), 0),
        'costoUSD', COALESCE(sum(COALESCE(p.costo_usd, 0)), 0),
        'ventaMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0)), 0),
        'costoMXN', COALESCE(sum(COALESCE(p.costo_mxn, 0)), 0),
        'profitMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0) - COALESCE(p.costo_mxn, 0)), 0)
      ) AS val
      FROM activos eb
      LEFT JOIN profit p ON p.embarque_id = eb.id
      WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_sig AND eb.eta <= v_fin_sig
    )
    SELECT jsonb_build_object(
      'totalActivos', (SELECT count(*) FROM activos),
      'conteoPorEstado', COALESCE((SELECT val FROM conteo), '{}'::jsonb),
      'arribosEsteMes', COALESCE((SELECT val FROM arribos_mes), '{}'::jsonb),
      'resumenMesSiguiente', COALESCE((SELECT val FROM resumen_sig), '{}'::jsonb)
    )
  );
END;
$function$;

-- ============================================================================
-- dashboard_details: añade campos MXN por embarque y al resumen mes siguiente
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dashboard_details()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoy date := current_date;
  v_inicio_mes date := date_trunc('month', v_hoy)::date;
  v_fin_mes date := (date_trunc('month', v_hoy) + interval '1 month' - interval '1 day')::date;
  v_inicio_sig date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_fin_sig date := (date_trunc('month', v_hoy) + interval '2 months' - interval '1 day')::date;
  v_dias_libres int := 7;
  v_nombre_mes text;
  v_meses text[] := ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
BEGIN
  v_nombre_mes := v_meses[extract(month from v_inicio_sig)::int] || ' ' || extract(year from v_inicio_sig)::text;

  RETURN (
    WITH embarques_base AS (
      SELECT e.id, e.expediente, e.cliente_nombre, e.cliente_id, e.modo::text, e.tipo::text,
             e.estado::text, e.etd, e.eta, e.operador,
             e.puerto_origen, e.puerto_destino,
             e.aeropuerto_origen, e.aeropuerto_destino,
             e.ciudad_origen, e.ciudad_destino, e.contenedor, e.created_at,
             e.tipo_cambio_usd, e.tipo_cambio_eur,
        CASE
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
    ),
    profit AS (SELECT * FROM profit_por_embarque()),
    activos AS (SELECT * FROM embarques_base WHERE estado_real NOT IN ('EIR','Cerrado','Cancelado')),
    alertas_src AS (
      SELECT a.* FROM activos a
      WHERE a.estado_real = 'Arribo' AND a.eta IS NOT NULL AND (v_hoy - a.eta) >= v_dias_libres
      ORDER BY (v_hoy - a.eta) DESC LIMIT 15
    ),
    alertas AS (
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'expediente', a.expediente, 'cliente_nombre', a.cliente_nombre,
        'modo', a.modo, 'tipo', a.tipo, 'estado', a.estado, 'estadoReal', a.estado_real,
        'etd', a.etd, 'eta', a.eta, 'operador', a.operador,
        'puerto_origen', a.puerto_origen, 'puerto_destino', a.puerto_destino,
        'aeropuerto_origen', a.aeropuerto_origen, 'aeropuerto_destino', a.aeropuerto_destino,
        'ciudad_origen', a.ciudad_origen, 'ciudad_destino', a.ciudad_destino,
        'contenedor', a.contenedor, 'created_at', a.created_at,
        'diasDesdeEta', (v_hoy - a.eta),
        'diasDemora', (v_hoy - a.eta) - v_dias_libres
      )) AS val FROM alertas_src a
    ),
    proximos_src AS (
      SELECT a.* FROM activos a
      WHERE a.estado_real = 'En Tránsito' AND a.eta IS NOT NULL
        AND (a.eta - v_hoy) >= 0 AND (a.eta - v_hoy) <= 7
      ORDER BY (a.eta - v_hoy) ASC LIMIT 15
    ),
    proximos AS (
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'expediente', a.expediente, 'cliente_nombre', a.cliente_nombre,
        'modo', a.modo, 'tipo', a.tipo, 'estado', a.estado, 'estadoReal', a.estado_real,
        'etd', a.etd, 'eta', a.eta, 'operador', a.operador,
        'puerto_origen', a.puerto_origen, 'puerto_destino', a.puerto_destino,
        'aeropuerto_origen', a.aeropuerto_origen, 'aeropuerto_destino', a.aeropuerto_destino,
        'ciudad_origen', a.ciudad_origen, 'ciudad_destino', a.ciudad_destino,
        'contenedor', a.contenedor, 'created_at', a.created_at,
        'diasRestantes', (a.eta - v_hoy)
      )) AS val FROM proximos_src a
    ),
    profit_este_mes_src AS (
      SELECT eb.*, p.venta_usd, p.costo_usd, p.venta_mxn, p.costo_mxn,
             p.venta_mxn_from_usd, p.costo_mxn_from_usd,
             p.venta_mxn_from_eur, p.costo_mxn_from_eur,
             p.venta_mxn_native, p.costo_mxn_native
      FROM activos eb LEFT JOIN profit p ON p.embarque_id = eb.id
      WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_mes AND eb.eta <= v_fin_mes
        AND (COALESCE(p.venta_mxn, 0) > 0 OR COALESCE(p.costo_mxn, 0) > 0)
      ORDER BY (COALESCE(p.venta_mxn, 0) - COALESCE(p.costo_mxn, 0)) DESC LIMIT 30
    ),
    profit_este_mes AS (
      SELECT jsonb_agg(jsonb_build_object(
        'id', eb.id, 'expediente', eb.expediente, 'cliente_nombre', eb.cliente_nombre,
        'modo', eb.modo, 'tipo', eb.tipo, 'estado', eb.estado, 'estadoReal', eb.estado_real,
        'etd', eb.etd, 'eta', eb.eta, 'operador', eb.operador,
        'puerto_origen', eb.puerto_origen, 'puerto_destino', eb.puerto_destino,
        'aeropuerto_origen', eb.aeropuerto_origen, 'aeropuerto_destino', eb.aeropuerto_destino,
        'ciudad_origen', eb.ciudad_origen, 'ciudad_destino', eb.ciudad_destino,
        'contenedor', eb.contenedor, 'created_at', eb.created_at,
        'tipoCambioUSD', eb.tipo_cambio_usd, 'tipoCambioEUR', eb.tipo_cambio_eur,
        'ventaUSD', COALESCE(eb.venta_usd, 0),
        'costoUSD', COALESCE(eb.costo_usd, 0),
        'ventaMXN', COALESCE(eb.venta_mxn, 0),
        'costoMXN', COALESCE(eb.costo_mxn, 0),
        'profitMXN', COALESCE(eb.venta_mxn, 0) - COALESCE(eb.costo_mxn, 0),
        'margenMXN', CASE WHEN COALESCE(eb.venta_mxn, 0) > 0
                          THEN ((COALESCE(eb.venta_mxn, 0) - COALESCE(eb.costo_mxn, 0)) / eb.venta_mxn) * 100
                          ELSE 0 END,
        'ventaMxnFromUsd', COALESCE(eb.venta_mxn_from_usd, 0),
        'costoMxnFromUsd', COALESCE(eb.costo_mxn_from_usd, 0),
        'ventaMxnFromEur', COALESCE(eb.venta_mxn_from_eur, 0),
        'costoMxnFromEur', COALESCE(eb.costo_mxn_from_eur, 0),
        'ventaMxnNative', COALESCE(eb.venta_mxn_native, 0),
        'costoMxnNative', COALESCE(eb.costo_mxn_native, 0),
        'profit', COALESCE(eb.venta_usd, 0) - COALESCE(eb.costo_usd, 0),
        'margen', CASE WHEN COALESCE(eb.venta_usd, 0) > 0
                       THEN ((COALESCE(eb.venta_usd, 0) - COALESCE(eb.costo_usd, 0)) / eb.venta_usd) * 100
                       ELSE 0 END
      )) AS val FROM profit_este_mes_src eb
    ),
    mes_sig_src AS (
      SELECT eb.*, p.venta_usd, p.costo_usd, p.venta_mxn, p.costo_mxn,
             p.venta_mxn_from_usd, p.costo_mxn_from_usd,
             p.venta_mxn_from_eur, p.costo_mxn_from_eur,
             p.venta_mxn_native, p.costo_mxn_native,
             EXISTS (
               SELECT 1 FROM facturas f
               WHERE f.embarque_id = eb.id
                 AND f.estado::text NOT IN ('Cancelada','Borrador')
             ) AS facturado_flag
      FROM activos eb LEFT JOIN profit p ON p.embarque_id = eb.id
      WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_sig AND eb.eta <= v_fin_sig
      ORDER BY eb.eta ASC LIMIT 30
    ),
    mes_sig AS (
      SELECT jsonb_agg(jsonb_build_object(
        'id', eb.id, 'expediente', eb.expediente, 'cliente_nombre', eb.cliente_nombre,
        'modo', eb.modo, 'tipo', eb.tipo, 'estado', eb.estado, 'estadoReal', eb.estado_real,
        'etd', eb.etd, 'eta', eb.eta, 'operador', eb.operador,
        'puerto_origen', eb.puerto_origen, 'puerto_destino', eb.puerto_destino,
        'aeropuerto_origen', eb.aeropuerto_origen, 'aeropuerto_destino', eb.aeropuerto_destino,
        'ciudad_origen', eb.ciudad_origen, 'ciudad_destino', eb.ciudad_destino,
        'contenedor', eb.contenedor, 'created_at', eb.created_at,
        'tipoCambioUSD', eb.tipo_cambio_usd, 'tipoCambioEUR', eb.tipo_cambio_eur,
        'ventaUSD', COALESCE(eb.venta_usd, 0),
        'costoUSD', COALESCE(eb.costo_usd, 0),
        'ventaMXN', COALESCE(eb.venta_mxn, 0),
        'costoMXN', COALESCE(eb.costo_mxn, 0),
        'profitMXN', COALESCE(eb.venta_mxn, 0) - COALESCE(eb.costo_mxn, 0),
        'margenMXN', CASE WHEN COALESCE(eb.venta_mxn, 0) > 0
                          THEN ((COALESCE(eb.venta_mxn, 0) - COALESCE(eb.costo_mxn, 0)) / eb.venta_mxn) * 100
                          ELSE 0 END,
        'ventaMxnFromUsd', COALESCE(eb.venta_mxn_from_usd, 0),
        'costoMxnFromUsd', COALESCE(eb.costo_mxn_from_usd, 0),
        'ventaMxnFromEur', COALESCE(eb.venta_mxn_from_eur, 0),
        'costoMxnFromEur', COALESCE(eb.costo_mxn_from_eur, 0),
        'ventaMxnNative', COALESCE(eb.venta_mxn_native, 0),
        'costoMxnNative', COALESCE(eb.costo_mxn_native, 0),
        'profit', COALESCE(eb.venta_usd, 0) - COALESCE(eb.costo_usd, 0),
        'margen', CASE WHEN COALESCE(eb.venta_usd, 0) > 0
                       THEN ((COALESCE(eb.venta_usd, 0) - COALESCE(eb.costo_usd, 0)) / eb.venta_usd) * 100
                       ELSE 0 END,
        'facturado', eb.facturado_flag
      )) AS val FROM mes_sig_src eb
    ),
    mes_sig_resumen AS (
      SELECT jsonb_build_object(
        'totalEmbarques', count(*),
        'ventaUSD', COALESCE(sum(COALESCE(venta_usd, 0)), 0),
        'costoUSD', COALESCE(sum(COALESCE(costo_usd, 0)), 0),
        'profitUSD', COALESCE(sum(COALESCE(venta_usd, 0) - COALESCE(costo_usd, 0)), 0),
        'ventaMXN', COALESCE(sum(COALESCE(venta_mxn, 0)), 0),
        'costoMXN', COALESCE(sum(COALESCE(costo_mxn, 0)), 0),
        'profitMXN', COALESCE(sum(COALESCE(venta_mxn, 0) - COALESCE(costo_mxn, 0)), 0),
        'facturados', count(*) FILTER (WHERE facturado_flag),
        'nombreMes', v_nombre_mes
      ) AS val FROM mes_sig_src
    ),
    cargas_cliente AS (
      SELECT jsonb_agg(x ORDER BY (x->>'total')::int DESC) AS val
      FROM (
        SELECT jsonb_build_object(
          'clienteId', cliente_id,
          'clienteNombre', cliente_nombre,
          'total', count(*),
          'desglose', jsonb_build_object(
            'Confirmado',   count(*) FILTER (WHERE estado_real = 'Confirmado'),
            'En Tránsito',  count(*) FILTER (WHERE estado_real = 'En Tránsito'),
            'Arribo',       count(*) FILTER (WHERE estado_real = 'Arribo'),
            'En Aduana',    count(*) FILTER (WHERE estado_real = 'En Aduana'),
            'Entregado',    count(*) FILTER (WHERE estado_real = 'Entregado')
          )
        ) AS x
        FROM activos WHERE cliente_id IS NOT NULL
        GROUP BY cliente_id, cliente_nombre
        ORDER BY count(*) DESC LIMIT 10
      ) sub
    ),
    cargas_total AS (
      SELECT count(*) FILTER (
        WHERE cliente_id IS NOT NULL
          AND estado_real IN ('Confirmado','En Tránsito','Arribo','En Aduana','Entregado')
      )::int AS val
      FROM activos
    )
    SELECT jsonb_build_object(
      'alertasDemora', COALESCE((SELECT val FROM alertas), '[]'::jsonb),
      'proximosArribos', COALESCE((SELECT val FROM proximos), '[]'::jsonb),
      'profitArribosEsteMes', COALESCE((SELECT val FROM profit_este_mes), '[]'::jsonb),
      'embarquesMesSiguiente', COALESCE((SELECT val FROM mes_sig), '[]'::jsonb),
      'resumenMesSiguiente', COALESCE((SELECT val FROM mes_sig_resumen), jsonb_build_object(
        'totalEmbarques', 0, 'ventaUSD', 0, 'costoUSD', 0, 'profitUSD', 0,
        'ventaMXN', 0, 'costoMXN', 0, 'profitMXN', 0,
        'facturados', 0, 'nombreMes', v_nombre_mes
      )),
      'cargasPorCliente', COALESCE((SELECT val FROM cargas_cliente), '[]'::jsonb),
      'cargasActivasTotal', COALESCE((SELECT val FROM cargas_total), 0)
    )
  );
END;
$function$;