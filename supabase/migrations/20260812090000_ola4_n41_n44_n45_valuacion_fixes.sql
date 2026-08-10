-- Ola 4 · N41: gastos_op_facturas de dashboard_summary/details no debe
--   convertir EUR con TC USD ni sumar factura sin TC confiable como 1:1.
-- Ola 4 · N44: cartera_pendiente debe convertir las NCs aplicadas a la
--   moneda de la factura antes de restarlas (antes se restaban 1:1).
-- Ola 4 · N45: dashboard_details.mes_sig_src debe excluir facturas
--   'Sustituida' del flag "facturado" (ya no son CFDI vigente).

CREATE OR REPLACE FUNCTION public.cartera_pendiente()
RETURNS TABLE(
  id uuid, numero text, cliente_id uuid, cliente_nombre text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_vencido int,
  moneda text, total numeric, pagado numeric, saldo numeric,
  ultima_gestion date
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre, f.tipo_cambio AS factura_tc,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL),0) AS pagado,
      COALESCE((SELECT SUM(
                 CASE
                   WHEN nc.moneda::text = f.moneda::text THEN nc.monto
                   WHEN f.moneda::text = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
                     THEN nc.monto * nc.tipo_cambio
                   WHEN f.moneda::text <> 'MXN' AND nc.moneda::text = 'MXN' AND f.tipo_cambio > 1
                     THEN nc.monto / f.tipo_cambio
                   WHEN f.moneda::text <> 'MXN' AND nc.moneda::text <> 'MXN'
                        AND f.moneda::text <> nc.moneda::text
                        AND nc.tipo_cambio > 1 AND f.tipo_cambio > 1
                     THEN (nc.monto * nc.tipo_cambio) / f.tipo_cambio
                   ELSE NULL
                 END)
                FROM public.factura_notas_credito nc
                 WHERE nc.factura_id=f.id AND nc.estado='Aplicada' AND nc.deleted_at IS NULL),0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    (CURRENT_DATE - b.fecha_vencimiento)::int,
    b.moneda, b.total, b.pagado,
    (b.total - b.pagado - b.nc_aplicadas),
    (SELECT MAX(cs.fecha) FROM public.cobranza_seguimiento cs WHERE cs.factura_id=b.id)
  FROM base b
  LEFT JOIN public.clientes c ON c.id = b.cliente_id
  LEFT JOIN public.embarques e ON e.id = b.embarque_id
  WHERE (b.total - b.pagado - b.nc_aplicadas) > 0.005
    AND (public.org_scope() IS NULL OR c.organization_id = public.org_scope() OR c.organization_id IS NULL)
  ORDER BY b.fecha_vencimiento ASC NULLS LAST
  LIMIT 500
$function$;

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
      SELECT e.id, e.estado::text, e.modo, e.tipo, e.etd, e.eta, e.tipo_cambio_eur,
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
    -- Ola 4 · N41: valuación por moneda propia del gasto — MXN directo; USD
    -- sólo con tipo_cambio_usd > 1 (antes DEFAULT 0 lo sumaba como total*0=0
    -- sin avisar); EUR con el tipo_cambio_eur del EMBARQUE vinculado (antes
    -- se valuaba erróneamente con el TC USD). Sin TC confiable: no suma.
    gastos_op_facturas AS (
      SELECT COALESCE(SUM(
        CASE
          WHEN pf.moneda = 'MXN' THEN pf.total
          WHEN pf.moneda = 'USD' AND pf.tipo_cambio_usd > 1 THEN pf.total * pf.tipo_cambio_usd
          WHEN pf.moneda = 'EUR' AND eb.tipo_cambio_eur > 1 THEN pf.total * eb.tipo_cambio_eur
          ELSE NULL
        END
      ), 0) AS val
      FROM proveedor_facturas pf
      JOIN presupuesto_categorias pc ON pc.id = pf.categoria_presupuesto_id
      LEFT JOIN embarques_base eb ON eb.id = pf.embarque_id
      WHERE pc.tipo_contable IN ('Venta','Administracion')
        AND pf.deleted_at IS NULL
        AND pf.fecha_emision BETWEEN v_inicio_mes AND v_fin_mes
        AND (pf.organization_id = public.org_scope())
    ),
    -- Ola 4 · N41: conteo de facturas de gasto excluidas por falta de TC
    -- confiable (llave aditiva, no rompe parsers existentes).
    gastos_op_sin_tc AS (
      SELECT COUNT(*) AS val
      FROM proveedor_facturas pf
      JOIN presupuesto_categorias pc ON pc.id = pf.categoria_presupuesto_id
      LEFT JOIN embarques_base eb ON eb.id = pf.embarque_id
      WHERE pc.tipo_contable IN ('Venta','Administracion')
        AND pf.deleted_at IS NULL
        AND pf.fecha_emision BETWEEN v_inicio_mes AND v_fin_mes
        AND (pf.organization_id = public.org_scope())
        AND pf.moneda <> 'MXN'
        AND NOT (pf.moneda = 'USD' AND pf.tipo_cambio_usd > 1)
        AND NOT (pf.moneda = 'EUR' AND eb.tipo_cambio_eur > 1)
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
                 -- Ola 4 · N45: 'Sustituida' ya no es CFDI vigente; excluirla
                 -- del flag "facturado" (antes sólo excluía Cancelada/Borrador).
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

REVOKE ALL ON FUNCTION public.dashboard_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO authenticated;

REVOKE ALL ON FUNCTION public.dashboard_details() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_details() FROM anon;
GRANT EXECUTE ON FUNCTION public.dashboard_details() TO authenticated;

REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM anon;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente() TO authenticated;
