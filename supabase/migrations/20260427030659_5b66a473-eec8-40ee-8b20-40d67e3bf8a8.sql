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
  profit AS (
    SELECT p.embarque_id, p.venta_usd, p.costo_usd
    FROM profit_por_embarque() p
  ),
  activos AS (
    SELECT * FROM embarques_base
    WHERE estado_real NOT IN ('EIR','Cerrado','Cancelado')
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
        'contenedor', a.contenedor,
        'created_at', a.created_at,
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
        'contenedor', a.contenedor,
        'created_at', a.created_at,
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
        'contenedor', eb.contenedor,
        'created_at', eb.created_at,
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
        'contenedor', eb.contenedor,
        'created_at', eb.created_at,
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