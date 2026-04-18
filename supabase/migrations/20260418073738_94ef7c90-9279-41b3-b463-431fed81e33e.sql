-- RPC: operaciones_stats — agrega TODOS los KPIs y datos por operador en una sola llamada server-side
CREATE OR REPLACE FUNCTION public.operaciones_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_hoy date := current_date;
  v_dias_libres int := 7;
  v_max_contenedores int := 150;
BEGIN
  WITH base AS (
    SELECT
      e.id, e.expediente, e.cliente_nombre, e.cliente_id,
      e.modo::text AS modo, e.tipo::text AS tipo, e.estado::text AS estado,
      e.etd, e.eta, e.operador, e.fecha_llegada_real, e.created_at,
      CASE
        WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Cerrado') THEN e.estado::text
        WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación'
             AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
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
  enriched AS (
    SELECT
      b.*,
      COALESCE(p.venta_usd, 0) AS venta_usd,
      COALESCE(p.costo_usd, 0) AS costo_usd,
      COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0) AS profit,
      COALESCE(NULLIF(b.operador, ''), 'Sin Asignar') AS operador_norm,
      CASE
        WHEN b.estado_real IN ('Arribo','En Aduana') AND b.eta IS NOT NULL THEN
          CASE WHEN (v_hoy - b.eta) > v_dias_libres THEN 'critico'
               ELSE 'en_puerto' END
        WHEN b.estado_real = 'En Tránsito' AND b.eta IS NOT NULL
             AND (b.eta - v_hoy) BETWEEN 0 AND 7 THEN 'por_arribar'
        ELSE 'ok'
      END AS riesgo,
      CASE
        WHEN b.estado_real IN ('Arribo','En Aduana') AND b.eta IS NOT NULL
        THEN GREATEST(v_hoy - b.eta, 0) ELSE 0
      END AS dias_en_puerto,
      CASE
        WHEN b.estado_real NOT IN ('EIR','Cerrado','Cancelado') THEN true ELSE false
      END AS es_activo
    FROM base b
    LEFT JOIN profit p ON p.embarque_id = b.id
  ),
  meses AS (
    SELECT n,
      to_char(date_trunc('month', v_hoy) - (n || ' months')::interval, 'TMMon') AS label,
      (date_trunc('month', v_hoy) - (n || ' months')::interval)::date AS inicio,
      (date_trunc('month', v_hoy) - (n || ' months')::interval + interval '1 month - 1 day')::date AS fin
    FROM generate_series(0, 5) n
  ),
  por_operador AS (
    SELECT
      operador_norm AS nombre,
      count(*) FILTER (WHERE es_activo) AS cargas_activas,
      count(*) FILTER (WHERE es_activo) AS contenedores,
      count(*) FILTER (
        WHERE COALESCE(etd, created_at::date) >= date_trunc('month', v_hoy)::date
          AND COALESCE(etd, created_at::date) <= (date_trunc('month', v_hoy) + interval '1 month - 1 day')::date
      ) AS este_mes,
      sum(profit) AS profit,
      count(*) FILTER (WHERE es_activo AND riesgo = 'critico') AS criticos,
      count(*) FILTER (WHERE es_activo AND riesgo = 'en_puerto') AS en_puerto,
      count(*) FILTER (WHERE es_activo AND riesgo = 'por_arribar') AS por_arribar,
      count(*) FILTER (
        WHERE estado_real = 'Arribo' AND eta IS NOT NULL AND (v_hoy - eta) > v_dias_libres
      ) AS demoras,
      count(*) FILTER (WHERE es_activo AND estado_real = 'Confirmado') AS conf,
      count(*) FILTER (WHERE es_activo AND estado_real = 'En Tránsito') AS trans,
      count(*) FILTER (WHERE es_activo AND estado_real = 'Arribo') AS llegada,
      count(*) FILTER (WHERE es_activo AND estado_real IN ('En Aduana','Entregado')) AS proceso,
      count(*) FILTER (WHERE estado_real IN ('EIR','Cerrado')) AS cerrado
    FROM enriched
    GROUP BY operador_norm
  ),
  riesgos_por_op AS (
    SELECT operador_norm,
      jsonb_agg(
        jsonb_build_object(
          'id', id, 'expediente', expediente, 'cliente_nombre', cliente_nombre,
          'operador', operador_norm, 'estadoReal', estado_real,
          'nivelRiesgo', riesgo, 'eta', eta,
          'diasEnPuerto', dias_en_puerto, 'profit', profit
        )
        ORDER BY CASE riesgo WHEN 'critico' THEN 0 WHEN 'en_puerto' THEN 1 WHEN 'por_arribar' THEN 2 ELSE 3 END
      ) AS cargas
    FROM enriched
    WHERE es_activo AND riesgo != 'ok'
    GROUP BY operador_norm
  ),
  clientes_por_op AS (
    SELECT operador_norm,
      jsonb_agg(
        jsonb_build_object(
          'nombre', cliente_nombre,
          'cantidad', total,
          'desgloseEstados', jsonb_build_object(
            'Confirmado', conf, 'En Tránsito', trans,
            'Llegada', llegada, 'En Proceso', proceso, 'Cerrado', cerrado
          )
        ) ORDER BY total DESC
      ) AS clientes
    FROM (
      SELECT
        operador_norm, cliente_nombre,
        count(*) AS total,
        count(*) FILTER (WHERE estado_real = 'Confirmado') AS conf,
        count(*) FILTER (WHERE estado_real = 'En Tránsito') AS trans,
        count(*) FILTER (WHERE estado_real = 'Arribo') AS llegada,
        count(*) FILTER (WHERE estado_real IN ('En Aduana','Entregado')) AS proceso,
        count(*) FILTER (WHERE estado_real IN ('EIR','Cerrado')) AS cerrado
      FROM enriched
      WHERE es_activo OR estado_real IN ('EIR','Cerrado')
      GROUP BY operador_norm, cliente_nombre
    ) sub
    GROUP BY operador_norm
  ),
  historico_por_op AS (
    SELECT operador_norm,
      jsonb_agg(
        jsonb_build_object('mes', label, 'creados', creados, 'llegados', llegados)
        ORDER BY n DESC
      ) AS historico
    FROM (
      SELECT e.operador_norm, m.n, m.label,
        count(*) FILTER (
          WHERE COALESCE(e.etd, e.created_at::date) BETWEEN m.inicio AND m.fin
        ) AS creados,
        count(*) FILTER (
          WHERE COALESCE(
            e.fecha_llegada_real,
            CASE WHEN e.estado_real IN ('Entregado','EIR','Cerrado') THEN e.eta END
          ) BETWEEN m.inicio AND m.fin
        ) AS llegados
      FROM enriched e CROSS JOIN meses m
      GROUP BY e.operador_norm, m.n, m.label
    ) sub
    GROUP BY operador_norm
  ),
  operadores_full AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'nombre', po.nombre,
          'cargasActivas', po.cargas_activas,
          'contenedores', po.contenedores,
          'cargasEsteMes', po.este_mes,
          'profit', po.profit,
          'demoras', po.demoras,
          'criticos', po.criticos,
          'enPuerto', po.en_puerto,
          'porArribar', po.por_arribar,
          'desgloseEstados', jsonb_build_object(
            'Confirmado', po.conf, 'En Tránsito', po.trans,
            'Llegada', po.llegada, 'En Proceso', po.proceso, 'Cerrado', po.cerrado
          ),
          'clientesDesglose', COALESCE(cpo.clientes, '[]'::jsonb),
          'cargasEnRiesgo', COALESCE(rpo.cargas, '[]'::jsonb),
          'historico', COALESCE(hpo.historico, '[]'::jsonb)
        ) ORDER BY po.profit DESC
      ) AS val
    FROM por_operador po
    LEFT JOIN clientes_por_op cpo ON cpo.operador_norm = po.nombre
    LEFT JOIN riesgos_por_op rpo ON rpo.operador_norm = po.nombre
    LEFT JOIN historico_por_op hpo ON hpo.operador_norm = po.nombre
  ),
  global AS (
    SELECT jsonb_build_object(
      'totalActivas', count(*) FILTER (WHERE es_activo),
      'totalContenedores', count(*) FILTER (WHERE es_activo),
      'totalEsteMes', count(*) FILTER (
        WHERE COALESCE(etd, created_at::date) >= date_trunc('month', v_hoy)::date
          AND COALESCE(etd, created_at::date) <= (date_trunc('month', v_hoy) + interval '1 month - 1 day')::date
      ),
      'totalProfit', COALESCE(sum(profit), 0),
      'totalDemoras', count(*) FILTER (
        WHERE estado_real = 'Arribo' AND eta IS NOT NULL AND (v_hoy - eta) > v_dias_libres
      ),
      'totalCriticos', count(*) FILTER (WHERE es_activo AND riesgo = 'critico'),
      'totalEnPuerto', count(*) FILTER (WHERE es_activo AND riesgo = 'en_puerto'),
      'totalPorArribar', count(*) FILTER (WHERE es_activo AND riesgo = 'por_arribar'),
      'activasHoy', count(*) FILTER (WHERE es_activo),
      'maxContenedores', v_max_contenedores
    ) AS val
    FROM enriched
  ),
  historico_global AS (
    SELECT jsonb_agg(
      jsonb_build_object('mes', label, 'creadas', creadas, 'llegadas', llegadas)
      ORDER BY n DESC
    ) AS val
    FROM (
      SELECT m.n, m.label,
        count(*) FILTER (
          WHERE COALESCE(e.etd, e.created_at::date) BETWEEN m.inicio AND m.fin
        ) AS creadas,
        count(*) FILTER (
          WHERE COALESCE(
            e.fecha_llegada_real,
            CASE WHEN e.estado_real IN ('Entregado','EIR','Cerrado') THEN e.eta END
          ) BETWEEN m.inicio AND m.fin
        ) AS llegadas
      FROM meses m LEFT JOIN enriched e ON true
      GROUP BY m.n, m.label
    ) sub
  ),
  meses_labels AS (
    SELECT jsonb_agg(label ORDER BY n DESC) AS val FROM meses
  )
  SELECT jsonb_build_object(
    'operadores', COALESCE(operadores_full.val, '[]'::jsonb),
    'global', global.val,
    'historicoGlobal', COALESCE(historico_global.val, '[]'::jsonb),
    'mesesLabels', meses_labels.val
  ) INTO result
  FROM operadores_full, global, historico_global, meses_labels;

  RETURN result;
END;
$$;