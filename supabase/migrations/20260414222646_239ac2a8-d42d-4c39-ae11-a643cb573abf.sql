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
           e.ciudad_origen, e.ciudad_destino, e.created_at,
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
  factura_set AS (
    SELECT DISTINCT f.embarque_id
    FROM facturas f
    WHERE (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
  ),
  activos AS (
    SELECT * FROM embarques_base
    WHERE estado_real NOT IN ('EIR','Cerrado','Cancelado')
  ),

  -- 1. Conteo por estado
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

  -- 2. Alertas demora
  alertas AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', a.id, 'expediente', a.expediente, 'cliente_nombre', a.cliente_nombre,
        'modo', a.modo, 'tipo', a.tipo, 'estado', a.estado, 'estadoReal', a.estado_real,
        'etd', a.etd, 'eta', a.eta, 'operador', a.operador,
        'puerto_origen', a.puerto_origen, 'puerto_destino', a.puerto_destino,
        'aeropuerto_origen', a.aeropuerto_origen, 'aeropuerto_destino', a.aeropuerto_destino,
        'ciudad_origen', a.ciudad_origen, 'ciudad_destino', a.ciudad_destino,
        'created_at', a.created_at,
        'diasDesdeEta', (v_hoy - a.eta),
        'diasDemora', (v_hoy - a.eta) - v_dias_libres
      ) ORDER BY (v_hoy - a.eta) DESC
    ) AS val
    FROM activos a
    WHERE a.estado_real = 'Arribo' AND a.eta IS NOT NULL AND (v_hoy - a.eta) >= v_dias_libres
  ),

  -- 3. Próximos arribos
  proximos AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', a.id, 'expediente', a.expediente, 'cliente_nombre', a.cliente_nombre,
        'modo', a.modo, 'tipo', a.tipo, 'estado', a.estado, 'estadoReal', a.estado_real,
        'etd', a.etd, 'eta', a.eta, 'operador', a.operador,
        'puerto_origen', a.puerto_origen, 'puerto_destino', a.puerto_destino,
        'aeropuerto_origen', a.aeropuerto_origen, 'aeropuerto_destino', a.aeropuerto_destino,
        'ciudad_origen', a.ciudad_origen, 'ciudad_destino', a.ciudad_destino,
        'created_at', a.created_at,
        'diasRestantes', (a.eta - v_hoy)
      ) ORDER BY (a.eta - v_hoy) ASC
    ) AS val
    FROM activos a
    WHERE a.estado_real = 'En Tránsito' AND a.eta IS NOT NULL
      AND (a.eta - v_hoy) >= 0 AND (a.eta - v_hoy) <= 7
  ),

  -- 4. Profit arribos este mes
  profit_este_mes AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', eb.id, 'expediente', eb.expediente, 'cliente_nombre', eb.cliente_nombre,
        'modo', eb.modo, 'tipo', eb.tipo, 'estado', eb.estado, 'estadoReal', eb.estado_real,
        'etd', eb.etd, 'eta', eb.eta, 'operador', eb.operador,
        'puerto_origen', eb.puerto_origen, 'puerto_destino', eb.puerto_destino,
        'aeropuerto_origen', eb.aeropuerto_origen, 'aeropuerto_destino', eb.aeropuerto_destino,
        'ciudad_origen', eb.ciudad_origen, 'ciudad_destino', eb.ciudad_destino,
        'created_at', eb.created_at,
        'ventaUSD', COALESCE(p.venta_usd, 0),
        'costoUSD', COALESCE(p.costo_usd, 0),
        'profit', COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0),
        'margen', CASE WHEN COALESCE(p.venta_usd, 0) > 0
          THEN round(((COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0)) / p.venta_usd * 100)::numeric, 1)
          ELSE 0 END
      ) ORDER BY (COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0)) DESC
    ) AS val
    FROM activos eb
    LEFT JOIN profit p ON p.embarque_id = eb.id
    WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_mes AND eb.eta <= v_fin_mes
      AND (COALESCE(p.venta_usd, 0) > 0 OR COALESCE(p.costo_usd, 0) > 0)
  ),

  -- 5. Arribos este mes summary
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

  -- 6. Embarques mes siguiente
  mes_sig AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', eb.id, 'expediente', eb.expediente, 'cliente_nombre', eb.cliente_nombre,
        'modo', eb.modo, 'tipo', eb.tipo, 'estado', eb.estado, 'estadoReal', eb.estado_real,
        'etd', eb.etd, 'eta', eb.eta, 'operador', eb.operador,
        'puerto_origen', eb.puerto_origen, 'puerto_destino', eb.puerto_destino,
        'aeropuerto_origen', eb.aeropuerto_origen, 'aeropuerto_destino', eb.aeropuerto_destino,
        'ciudad_origen', eb.ciudad_origen, 'ciudad_destino', eb.ciudad_destino,
        'created_at', eb.created_at,
        'ventaUSD', COALESCE(p.venta_usd, 0),
        'costoUSD', COALESCE(p.costo_usd, 0),
        'profit', COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0),
        'margen', CASE WHEN COALESCE(p.venta_usd, 0) > 0
          THEN round(((COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0)) / p.venta_usd * 100)::numeric, 1)
          ELSE 0 END,
        'facturado', (fs.embarque_id IS NOT NULL)
      ) ORDER BY eb.eta ASC
    ) AS val
    FROM embarques_base eb
    LEFT JOIN profit p ON p.embarque_id = eb.id
    LEFT JOIN factura_set fs ON fs.embarque_id = eb.id
    WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_sig AND eb.eta <= v_fin_sig
  ),

  -- 7. Resumen facturación mes siguiente
  resumen_sig AS (
    SELECT jsonb_build_object(
      'totalEmbarques', count(*),
      'ventaUSD', COALESCE(sum(COALESCE(p.venta_usd, 0)), 0),
      'costoUSD', COALESCE(sum(COALESCE(p.costo_usd, 0)), 0),
      'profitUSD', COALESCE(sum(COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0)), 0),
      'facturados', count(*) FILTER (WHERE fs.embarque_id IS NOT NULL),
      'nombreMes', to_char(v_inicio_sig, 'TMMonth YYYY')
    ) AS val
    FROM embarques_base eb
    LEFT JOIN profit p ON p.embarque_id = eb.id
    LEFT JOIN factura_set fs ON fs.embarque_id = eb.id
    WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_sig AND eb.eta <= v_fin_sig
  ),

  -- 8. Total activos count
  total_activos AS (
    SELECT count(*) AS val FROM activos
    WHERE estado_real IN ('Confirmado','En Tránsito','Arribo','En Aduana','Entregado')
  ),

  -- 9. Arribos por semana del mes actual
  arribos_semana AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('semana', sub.semana, 'count', sub.cnt)
      ORDER BY sub.num_semana
    ), '[]'::jsonb) AS val
    FROM (
      SELECT
        'S' || (EXTRACT(DAY FROM eb.eta)::int - 1) / 7 + 1 AS semana,
        (EXTRACT(DAY FROM eb.eta)::int - 1) / 7 + 1 AS num_semana,
        count(*) AS cnt
      FROM embarques_base eb
      WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_mes AND eb.eta <= v_fin_mes
      GROUP BY (EXTRACT(DAY FROM eb.eta)::int - 1) / 7 + 1
    ) sub
  ),

  -- 10. Cargas activas por cliente
  cargas_cliente AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'clienteId', sub.cliente_id,
        'clienteNombre', sub.cliente_nombre,
        'total', sub.total,
        'desglose', jsonb_build_object(
          'Confirmado', sub.confirmado,
          'En Tránsito', sub.en_transito,
          'Arribo', sub.arribo,
          'En Aduana', sub.en_aduana,
          'Entregado', sub.entregado
        )
      ) ORDER BY sub.total DESC
    ), '[]'::jsonb) AS val
    FROM (
      SELECT
        a.cliente_id,
        a.cliente_nombre,
        count(*) AS total,
        count(*) FILTER (WHERE a.estado_real = 'Confirmado') AS confirmado,
        count(*) FILTER (WHERE a.estado_real = 'En Tránsito') AS en_transito,
        count(*) FILTER (WHERE a.estado_real = 'Arribo') AS arribo,
        count(*) FILTER (WHERE a.estado_real = 'En Aduana') AS en_aduana,
        count(*) FILTER (WHERE a.estado_real = 'Entregado') AS entregado
      FROM activos a
      WHERE a.estado_real IN ('Confirmado','En Tránsito','Arribo','En Aduana','Entregado')
      GROUP BY a.cliente_id, a.cliente_nombre
    ) sub
  )

  SELECT jsonb_build_object(
    'conteoPorEstado', conteo.val,
    'totalActivos', ta.val,
    'alertasDemora', COALESCE(alertas.val, '[]'::jsonb),
    'proximosArribos', COALESCE(proximos.val, '[]'::jsonb),
    'profitArribosEsteMes', COALESCE(profit_este_mes.val, '[]'::jsonb),
    'arribosEsteMes', arribos_mes.val,
    'embarquesMesSiguiente', COALESCE(mes_sig.val, '[]'::jsonb),
    'resumenMesSiguiente', resumen_sig.val,
    'arribosPorSemana', arribos_semana.val,
    'cargasPorCliente', cargas_cliente.val
  ) INTO result
  FROM conteo, alertas, proximos, profit_este_mes, arribos_mes, mes_sig, resumen_sig, total_activos ta, arribos_semana, cargas_cliente;

  RETURN result;
END;
$function$;