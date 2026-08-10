-- Ola 4 · N10: preservar 'Borrador' (fix B-033) en dashboard_summary,
-- dashboard_details y operaciones_stats. Un embarque marítimo de
-- Importación en Borrador con ETD/ETA capturadas se derivaba a
-- Confirmado/En Tránsito/Arribo y contaba como activo (KPIs falsos:
-- conteoPorEstado, totalActivos, cargasPorCliente, alertasDemora,
-- tarjetas de Operaciones). Se preserva 'Borrador' en estado_real y se
-- excluye de activos/es_activo en las tres funciones. Sólo se toca
-- N10; se conserva todo lo demás vigente (org_scope(), FIX C5, 'Por
-- liquidar').

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
          -- Ola 4 · N10 (guard B-033): preservar Borrador para que no se
          -- cuente como Confirmado por derivación ETD/ETA.
          WHEN e.estado = 'Borrador' THEN 'Borrador'
          WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado') THEN e.estado::text
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
      WHERE e.deleted_at IS NULL              -- FIX C5
        AND (e.organization_id = public.org_scope())
    ),
    profit AS (SELECT * FROM profit_por_embarque()),
    -- Ola 4 · N10 (B-033): Borrador ya no cuenta como activo operativo.
    activos AS (SELECT * FROM embarques_base WHERE estado_real NOT IN ('Borrador','EIR','Por liquidar','Cerrado','Cancelado')),
    conteo AS (
      SELECT jsonb_build_object(
        'Confirmado', count(*) FILTER (WHERE estado_real = 'Confirmado'),
        'En Tránsito', count(*) FILTER (WHERE estado_real = 'En Tránsito'),
        'Arribo', count(*) FILTER (WHERE estado_real = 'Arribo'),
        'En Aduana', count(*) FILTER (WHERE estado_real = 'En Aduana'),
        'Entregado', count(*) FILTER (WHERE estado_real = 'Entregado'),
        'EIR', count(*) FILTER (WHERE estado_real = 'EIR'),
        'Por liquidar', count(*) FILTER (WHERE estado_real = 'Por liquidar')
      ) AS val
      FROM embarques_base
    ),
    gastos_op_facturas AS (
      SELECT COALESCE(SUM(
        CASE WHEN pf.moneda = 'MXN' THEN pf.total
             WHEN pf.tipo_cambio_usd IS NOT NULL THEN pf.total * pf.tipo_cambio_usd
             ELSE pf.total END
      ), 0) AS val
      FROM proveedor_facturas pf
      JOIN presupuesto_categorias pc ON pc.id = pf.categoria_presupuesto_id
      WHERE pc.tipo_contable IN ('Venta','Administracion')
        AND pf.deleted_at IS NULL
        AND pf.fecha_emision BETWEEN v_inicio_mes AND v_fin_mes
        AND (pf.organization_id = public.org_scope())
    ),
    gastos_op_comisiones AS (
      SELECT COALESCE(SUM(total_mxn), 0) AS val
      FROM liquidaciones_comision
      WHERE periodo = to_char(v_inicio_mes, 'YYYY-MM')
        AND (organization_id = public.org_scope())
    ),
    arribos_mes AS (
      SELECT jsonb_build_object(
        'total', count(*),
        'yaLlegaron', count(*) FILTER (WHERE eb.estado_real IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado')),
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
        'profitUSD', COALESCE(sum(COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0)), 0),
        'gastosOperativosMXN',
          COALESCE((SELECT val FROM gastos_op_facturas), 0)
          + COALESCE((SELECT val FROM gastos_op_comisiones), 0)
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
$function$

;

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
          -- Ola 4 · N10 (guard B-033): preservar Borrador.
          WHEN e.estado = 'Borrador' THEN 'Borrador'
          WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado') THEN e.estado::text
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
      WHERE e.deleted_at IS NULL              -- FIX C5
        AND (e.organization_id = public.org_scope())
    ),
    profit AS (SELECT * FROM profit_por_embarque()),
    -- Ola 4 · N10 (B-033): Borrador ya no cuenta como activo operativo.
    activos AS (SELECT * FROM embarques_base WHERE estado_real NOT IN ('Borrador','EIR','Por liquidar','Cerrado','Cancelado')),
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
                 AND f.deleted_at IS NULL     -- FIX C5
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
    ),
    -- v13.303.13 · Listado ligero de EIR para el scope "mis embarques" del chip EIR.
    embarques_eir AS (
      SELECT jsonb_agg(jsonb_build_object(
        'id', eb.id,
        'operador', eb.operador,
        'estadoReal', eb.estado_real
      )) AS val
      FROM (
        SELECT id, operador, estado_real, created_at
        FROM embarques_base
        WHERE estado_real IN ('EIR','Por liquidar')
        ORDER BY created_at DESC
        LIMIT 500
      ) eb
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
      'cargasActivasTotal', COALESCE((SELECT val FROM cargas_total), 0),
      'embarquesEir', COALESCE((SELECT val FROM embarques_eir), '[]'::jsonb)
    )
  );
END;
$function$

;

CREATE OR REPLACE FUNCTION public.operaciones_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      e.puerto_origen, e.puerto_destino,
      e.aeropuerto_origen, e.aeropuerto_destino,
      e.ciudad_origen, e.ciudad_destino,
      CASE
        -- Ola 4 · N10 (guard B-033): preservar Borrador para que no se
        -- cuente como Confirmado por derivación ETD/ETA.
        WHEN e.estado = 'Borrador' THEN 'Borrador'
        WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado') THEN e.estado::text
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
    WHERE e.deleted_at IS NULL                -- FIX C5
      AND (e.organization_id = public.org_scope())
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
      -- Ola 4 · N10 (B-033): Borrador ya no cuenta como activo operativo.
      CASE
        WHEN b.estado_real NOT IN ('Borrador','EIR','Por liquidar','Cerrado','Cancelado') THEN true ELSE false
      END AS es_activo,
      -- Mapeo a llaves de UI
      CASE
        WHEN b.estado_real = 'Confirmado' THEN 'Confirmado'
        WHEN b.estado_real = 'En Tránsito' THEN 'En Tránsito'
        WHEN b.estado_real = 'Arribo' THEN 'Llegada'
        WHEN b.estado_real IN ('En Aduana','Entregado') THEN 'En Proceso'
        WHEN b.estado_real IN ('EIR','Por liquidar','Cerrado') THEN 'Cerrado'
        ELSE NULL
      END AS estado_ui,
      -- origen/destino con prioridad Port > Airport > City
      COALESCE(NULLIF(b.puerto_origen, ''), NULLIF(b.aeropuerto_origen, ''), NULLIF(b.ciudad_origen, ''), '') AS origen_txt,
      COALESCE(NULLIF(b.puerto_destino, ''), NULLIF(b.aeropuerto_destino, ''), NULLIF(b.ciudad_destino, ''), '') AS destino_txt
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
      count(*) FILTER (WHERE estado_real IN ('EIR','Por liquidar','Cerrado')) AS cerrado
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
        count(*) FILTER (WHERE estado_real IN ('EIR','Por liquidar','Cerrado')) AS cerrado
      FROM enriched
      WHERE es_activo OR estado_real IN ('EIR','Por liquidar','Cerrado')
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
            CASE WHEN e.estado_real IN ('Entregado','EIR','Por liquidar','Cerrado') THEN e.eta END
          ) BETWEEN m.inicio AND m.fin
        ) AS llegados
      FROM enriched e CROSS JOIN meses m
      GROUP BY e.operador_norm, m.n, m.label
    ) sub
    GROUP BY operador_norm
  ),
  -- NUEVO: detalle de embarques por (operador, estado_ui), con tope por estado
  embarques_ranked AS (
    SELECT
      operador_norm, estado_ui, id, expediente, cliente_nombre,
      modo, tipo, origen_txt, destino_txt, etd, eta, estado_real,
      dias_en_puerto, fecha_llegada_real,
      CASE WHEN estado_real = 'En Tránsito' AND eta IS NOT NULL THEN (eta - v_hoy) ELSE NULL END AS dias_para_eta,
      ROW_NUMBER() OVER (
        PARTITION BY operador_norm, estado_ui
        ORDER BY
          CASE WHEN estado_ui = 'Cerrado' THEN COALESCE(fecha_llegada_real, eta) END DESC NULLS LAST,
          CASE WHEN estado_ui <> 'Cerrado' THEN eta END ASC NULLS LAST,
          expediente ASC
      ) AS rn,
      COUNT(*) OVER (PARTITION BY operador_norm, estado_ui) AS total_estado
    FROM enriched
    WHERE estado_ui IS NOT NULL
  ),
  embarques_filtrados AS (
    SELECT * FROM embarques_ranked
    WHERE (estado_ui = 'Cerrado' AND rn <= 50) OR (estado_ui <> 'Cerrado' AND rn <= 200)
  ),
  embarques_por_estado AS (
    SELECT
      operador_norm,
      jsonb_object_agg(estado_ui, payload) AS embarques_por_estado
    FROM (
      SELECT
        operador_norm, estado_ui,
        jsonb_build_object(
          'total', max(total_estado),
          'truncated', max(total_estado) > count(*),
          'items', jsonb_agg(
            jsonb_build_object(
              'id', id,
              'expediente', expediente,
              'clienteNombre', cliente_nombre,
              'modo', modo,
              'tipo', tipo,
              'origen', origen_txt,
              'destino', destino_txt,
              'etd', etd,
              'eta', eta,
              'estadoReal', estado_real,
              'diasEnPuerto', dias_en_puerto,
              'diasParaEta', dias_para_eta
            ) ORDER BY rn
          )
        ) AS payload
      FROM embarques_filtrados
      GROUP BY operador_norm, estado_ui
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
          'historico', COALESCE(hpo.historico, '[]'::jsonb),
          'embarquesPorEstado', COALESCE(epe.embarques_por_estado, '{}'::jsonb)
        ) ORDER BY po.profit DESC
      ) AS val
    FROM por_operador po
    LEFT JOIN clientes_por_op cpo ON cpo.operador_norm = po.nombre
    LEFT JOIN riesgos_por_op rpo ON rpo.operador_norm = po.nombre
    LEFT JOIN historico_por_op hpo ON hpo.operador_norm = po.nombre
    LEFT JOIN embarques_por_estado epe ON epe.operador_norm = po.nombre
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
            CASE WHEN e.estado_real IN ('Entregado','EIR','Por liquidar','Cerrado') THEN e.eta END
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
$function$

;

-- H6: permisos explícitos (idempotente).
REVOKE ALL ON FUNCTION public.dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dashboard_details() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_details() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.operaciones_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.operaciones_stats() TO authenticated, service_role;
