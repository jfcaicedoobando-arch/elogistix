CREATE OR REPLACE FUNCTION public.dashboard_summary_datos()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_inicio_mes date := date_trunc('month', v_hoy)::date;
  v_fin_mes date := (date_trunc('month', v_hoy) + interval '1 month' - interval '1 day')::date;
  v_inicio_sig date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_fin_sig date := (date_trunc('month', v_hoy) + interval '2 months' - interval '1 day')::date;
BEGIN
  RETURN (
    WITH embarques_base AS (
      SELECT e.id, e.estado::text, e.modo, e.tipo, e.etd, e.eta,
        e.tipo_cambio_eur,
        CASE
          WHEN e.estado = 'Borrador' THEN 'Borrador'
          -- R221 (ELIMP00353): preservar Cancelado antes de derivar por ETD/ETA.
          WHEN e.estado = 'Cancelado' THEN 'Cancelado'
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
      WHERE e.deleted_at IS NULL
        AND (e.organization_id = public.org_scope())
    ),
    profit AS (SELECT * FROM profit_por_embarque()),
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
      -- FIX BL-11: EUR usa el TC del embarque ligado y, si no hay, el TC DOF
      -- vigente a fecha_emision (LEFT JOIN LATERAL sobre tipos_cambio_dof).
      SELECT COALESCE(SUM(
        CASE
          WHEN pf.moneda = 'MXN' THEN pf.total
          WHEN pf.moneda = 'USD' AND pf.tipo_cambio_usd > 1 THEN pf.total * pf.tipo_cambio_usd
          WHEN pf.moneda = 'EUR' AND COALESCE(eb.tipo_cambio_eur, dof.eur_mxn) > 1
               THEN pf.total * COALESCE(eb.tipo_cambio_eur, dof.eur_mxn)
          ELSE NULL
        END
      ), 0) AS val
      FROM proveedor_facturas pf
      JOIN presupuesto_categorias pc ON pc.id = pf.categoria_presupuesto_id
      LEFT JOIN embarques_base eb ON eb.id = pf.embarque_id
      LEFT JOIN LATERAL (
        SELECT d.eur_mxn
          FROM public.tipos_cambio_dof d
         WHERE d.fecha <= pf.fecha_emision
         ORDER BY d.fecha DESC
         LIMIT 1
      ) dof ON pf.moneda = 'EUR' AND eb.tipo_cambio_eur IS NULL
      WHERE pc.tipo_contable IN ('Venta','Administracion')
        AND pf.deleted_at IS NULL
        AND pf.fecha_emision BETWEEN v_inicio_mes AND v_fin_mes
        AND (pf.organization_id = public.org_scope())
    ),
    gastos_op_sin_tc AS (
      SELECT COUNT(*) AS val
      FROM proveedor_facturas pf
      JOIN presupuesto_categorias pc ON pc.id = pf.categoria_presupuesto_id
      LEFT JOIN embarques_base eb ON eb.id = pf.embarque_id
      LEFT JOIN LATERAL (
        SELECT d.eur_mxn
          FROM public.tipos_cambio_dof d
         WHERE d.fecha <= pf.fecha_emision
         ORDER BY d.fecha DESC
         LIMIT 1
      ) dof ON pf.moneda = 'EUR' AND eb.tipo_cambio_eur IS NULL
      WHERE pc.tipo_contable IN ('Venta','Administracion')
        AND pf.deleted_at IS NULL
        AND pf.fecha_emision BETWEEN v_inicio_mes AND v_fin_mes
        AND (pf.organization_id = public.org_scope())
        AND pf.moneda <> 'MXN'
        AND NOT (pf.moneda = 'USD' AND pf.tipo_cambio_usd > 1)
        AND NOT (pf.moneda = 'EUR' AND COALESCE(eb.tipo_cambio_eur, dof.eur_mxn, 0) > 1)
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
          + COALESCE((SELECT val FROM gastos_op_comisiones), 0),
        'gastosOperativosSinTC', COALESCE((SELECT val FROM gastos_op_sin_tc), 0)
      ) AS val
      FROM activos eb
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

CREATE OR REPLACE FUNCTION public.dashboard_details_datos()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_inicio_mes date := date_trunc('month', v_hoy)::date;
  v_fin_mes date := (date_trunc('month', v_hoy) + interval '1 month' - interval '1 day')::date;
  v_inicio_sig date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_fin_sig date := (date_trunc('month', v_hoy) + interval '2 months' - interval '1 day')::date;
  -- Fallback SÓLO cuando la naviera no tiene condiciones capturadas.
  v_dias_libres_fallback int := 7;
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
             e.naviera, e.organization_id,
             e.tipo_cambio_usd, e.tipo_cambio_eur,
        CASE
          -- Ola 4 · N10 (guard B-033): preservar Borrador.
          WHEN e.estado = 'Borrador' THEN 'Borrador'
          -- R221 (ELIMP00353): preservar Cancelado antes de derivar por ETD/ETA.
          WHEN e.estado = 'Cancelado' THEN 'Cancelado'
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
    activos AS (SELECT * FROM embarques_base WHERE estado_real NOT IN ('Borrador','EIR','Por liquidar','Cerrado','Cancelado')),
    demoras_ctx AS (
      SELECT a.id,
        (SELECT min((ev.fecha AT TIME ZONE 'America/Mexico_City')::date)
           FROM eventos_embarque ev
          WHERE ev.embarque_id = a.id AND ev.tipo = 'Descarga' AND ev.deleted_at IS NULL) AS fecha_desc_evento,
        (SELECT min(ec.fecha_descarga)
           FROM embarque_contenedores ec
          WHERE ec.embarque_id = a.id AND ec.deleted_at IS NULL) AS fecha_desc_cont,
        (SELECT max(ec.dias_libres_override)
           FROM embarque_contenedores ec
          WHERE ec.embarque_id = a.id AND ec.deleted_at IS NULL
            AND ec.dias_libres_override IS NOT NULL) AS dias_libres_cont,
        (SELECT cnc.dias_libres_demoras_default
           FROM costeo_navieras_condiciones cnc
           JOIN navieras n ON n.id = cnc.naviera_id
          WHERE cnc.organization_id = a.organization_id
            AND a.naviera IS NOT NULL
            AND lower(n.name) = lower(a.naviera)
          LIMIT 1) AS dias_libres_naviera
      FROM activos a
      WHERE a.estado_real = 'Arribo'
    ),
    demoras_calc AS (
      SELECT a.*,
        COALESCE(c.fecha_desc_evento, c.fecha_desc_cont, a.eta) AS fecha_base,
        (c.fecha_desc_evento IS NOT NULL OR c.fecha_desc_cont IS NOT NULL) AS base_real,
        COALESCE(c.dias_libres_cont, c.dias_libres_naviera, v_dias_libres_fallback) AS dias_libres
      FROM activos a
      JOIN demoras_ctx c ON c.id = a.id
    ),
    alertas_src AS (
      SELECT d.* FROM demoras_calc d
      WHERE d.fecha_base IS NOT NULL AND (v_hoy - d.fecha_base) >= d.dias_libres
      ORDER BY ((v_hoy - d.fecha_base) - d.dias_libres) DESC LIMIT 15
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
        'diasDesdeEta', COALESCE(v_hoy - a.eta, 0),
        'diasLibres', a.dias_libres,
        'baseDemora', CASE WHEN a.base_real THEN 'real' ELSE 'estimada' END,
        'fechaBaseDemora', a.fecha_base,
        'diasDemora', (v_hoy - a.fecha_base) - a.dias_libres
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
                 AND f.estado::text NOT IN ('Cancelada','Borrador','Sustituida')
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
$function$;

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
        -- R221 (ELIMP00353): preservar Cancelado ANTES de derivar por ETD/ETA;
        -- si no, un cancelado con ETA vencida se volvía 'Arribo' y sobrevivía
        -- al filtro posterior que pretendía excluirlo.
        WHEN e.estado = 'Cancelado' THEN 'Cancelado'
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
  -- R221: los contenedores se cuentan de embarque_contenedores, NO de embarques.
  -- Conversión a TEU explícita: 40'/45' = 2 TEU, 20' = 1 TEU, sin tipo = 1 TEU.
  teu_por_embarque AS (
    SELECT ec.embarque_id,
           count(*)::int AS contenedores_fisicos,
           sum(CASE
                 WHEN ec.tipo_contenedor ~ '4[05]' THEN 2
                 ELSE 1
               END)::int AS teu
    FROM embarque_contenedores ec
    WHERE ec.deleted_at IS NULL
      AND ec.organization_id = public.org_scope()
    GROUP BY ec.embarque_id
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
      COALESCE(t.teu, 0) AS teu,
      COALESCE(t.contenedores_fisicos, 0) AS contenedores_fisicos,
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
    LEFT JOIN teu_por_embarque t ON t.embarque_id = b.id
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
      COALESCE(sum(teu) FILTER (WHERE es_activo), 0) AS contenedores,
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
      'totalContenedores', COALESCE(sum(teu) FILTER (WHERE es_activo), 0),
      'totalContenedoresFisicos', COALESCE(sum(contenedores_fisicos) FILTER (WHERE es_activo), 0),
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
$function$;

CREATE OR REPLACE FUNCTION public.get_embarque_full(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- R221: un embarque en la papelera (deleted_at) NO debe abrirse por deep
    -- link ni por RPC: se responde NULL igual que si no existiera (ELIMP00293).
    WHEN NOT EXISTS (SELECT 1 FROM embarques WHERE id = p_embarque_id AND deleted_at IS NULL) THEN NULL
    ELSE jsonb_build_object(
      'embarque', (
        SELECT to_jsonb(s)
               || COALESCE((
                    SELECT to_jsonb(i) - 'id' - 'organization_id'
                    FROM embarques_interno_v i WHERE i.id = s.id
                  ), '{}'::jsonb)
        FROM (
          SELECT e.id, e.expediente, e.cliente_id, e.cliente_nombre, e.modo, e.tipo,
                 e.shipper, e.consignatario, e.descripcion_mercancia, e.peso_kg,
                 e.volumen_m3, e.piezas, e.incoterm, e.estado, e.operador,
                 e.puerto_origen, e.puerto_destino, e.naviera, e.bl_master, e.bl_house,
                 e.tipo_servicio, e.contenedor, e.tipo_contenedor,
                 e.aeropuerto_origen, e.aeropuerto_destino, e.aerolinea, e.mawb, e.hawb,
                 e.ciudad_origen, e.ciudad_destino, e.transportista, e.carta_porte,
                 e.etd, e.eta, e.fecha_llegada_real, e.fecha_creacion,
                 e.tipo_cambio_usd, e.tipo_cambio_eur, e.created_at, e.updated_at,
                 e.tipo_carga, e.msds_archivo, e.agente, e.cotizacion_id,
                 e.organization_id, e.tiene_proforma, e.etd_original, e.eta_original,
                 e.deleted_at, e.deleted_by, e.created_by, e.vendedora_id, e.tarifa_id,
                 e.carta_garantia, e.dias_libres_destino, e.dias_almacenaje, e.seguro,
                 e.valor_seguro_usd, e.notas, e.cerrado_at, e.cerrado_por,
                 e.reabierto_at, e.reabierto_por, e.tarifa_id_original,
                 e.tarifa_id_aplicada, e.tarifa_decision, e.tarifa_revalidada_en,
                 e.tarifa_revalidada_por, e.facturado_historico,
                 e.cobro_cliente_status, e.cobro_cliente_actualizado_at,
                 e.agente_id, e.naviera_id, e.sin_comision
          FROM embarques e WHERE e.id = p_embarque_id AND e.deleted_at IS NULL
        ) s
      ),
      'conceptosVenta', COALESCE((
        SELECT jsonb_agg(to_jsonb(cv.*) ORDER BY cv.created_at, cv.id)
        FROM conceptos_venta cv
        WHERE cv.embarque_id = p_embarque_id
          AND cv.deleted_at IS NULL
      ), '[]'::jsonb),
      'conceptosCosto', COALESCE((
        SELECT jsonb_agg(to_jsonb(cc.*) ORDER BY cc.created_at, cc.id)
        FROM conceptos_costo cc
        WHERE cc.embarque_id = p_embarque_id
          AND cc.deleted_at IS NULL
      ), '[]'::jsonb),
      'documentos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at, d.id)
        FROM documentos_embarque d
        WHERE d.embarque_id = p_embarque_id
          AND d.deleted_at IS NULL
      ), '[]'::jsonb),
      'notas', COALESCE((
        SELECT jsonb_agg(to_jsonb(n.*) ORDER BY n.fecha DESC)
        FROM notas_embarque n
        WHERE n.embarque_id = p_embarque_id
          AND n.deleted_at IS NULL
      ), '[]'::jsonb),
      'facturas', COALESCE((
        SELECT jsonb_agg(to_jsonb(f.*) ORDER BY f.created_at, f.id)
        FROM facturas f
        WHERE f.embarque_id = p_embarque_id
          AND f.deleted_at IS NULL
      ), '[]'::jsonb)
    )
  END;
$function$;

REVOKE ALL ON FUNCTION public.get_embarque_full(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_embarque_full(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_embarque_full(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dashboard_summary_datos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_summary_datos() TO service_role;
REVOKE ALL ON FUNCTION public.dashboard_details_datos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_details_datos() TO service_role;