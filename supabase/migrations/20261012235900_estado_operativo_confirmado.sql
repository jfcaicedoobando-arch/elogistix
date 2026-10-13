BEGIN;
-- Reconciliación antes de aplicación remota: preservar TC documental USD live
-- y fallback EUR/DOF ya presente en replay; destino único para ambos perfiles.
-- Sólo perfiles revisados. Un catálogo desconocido aborta sin tocar permisos.
-- Incluye las huellas origen/destino para permitir reaplicación segura.
DO $catalog$
DECLARE
  v_before jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('public._dashboard_details_calc()', '{postgres=X/postgres,service_role=X/postgres}'::aclitem[], ARRAY['bd27a92367b67f45fbb69a34cf94fae2','cc7e2612921d5ef39ed3966c6d3a6633','b9ed72e9af81cf91af30871213ce181d']::text[]),
      ('public._dashboard_summary_calc()', '{postgres=X/postgres,service_role=X/postgres}'::aclitem[], ARRAY['f17c4ac8d7a25176f6889d2e75fb870f','2edd0108da173a2dd2a42b7b33284d32','f0e0f8f057330a93752376620dbd0233']::text[]),
      ('public.dashboard_details_datos()', '{postgres=X/postgres,service_role=X/postgres}'::aclitem[], ARRAY['56a6cefe2fd1a34c53414399741cdb1f','3213c94b2e4c3fdb8821620e2a3c0b8d','af56ff59473b113e4e92da31e792364e','a16302364f75aa628aadbdb6f9aebda4']::text[]),
      ('public.dashboard_stats()', '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[], ARRAY['deeeae4c4f276d2f1b21a18373769ed1','41cefd193b94b7a1727f8bd41241f940','75ca87a1367d17c4b5f3f1c7e2bd33e0']::text[]),
      ('public.dashboard_summary_datos()', '{postgres=X/postgres,service_role=X/postgres}'::aclitem[], ARRAY['4b502966f817793971fc6a1aae833fe8','66972ee170fbac989e7c156e9ba28f07','08f19c5e9a821201533503fa9d67c5f2','834e3ac1463ece0d4356c8e9aab31448']::text[]),
      ('public.embarques_alertas_ids()', '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[], ARRAY['9ea050c6d8657727265dcae4fac9771b','2053475e512fb3795e31b3890a1e9cad']::text[]),
      ('public.operaciones_stats()', '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'::aclitem[], ARRAY['153a72ac2a691fa37a439cfdb934731e','e2cbb32c29af95e48f6d4f56244b1834']::text[]),
      ('public.sidebar_alert_counts()', '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[], ARRAY['2facd59641e72aa89deb51d71e7ad116','d5effa16f9ec089f4a1fae87f213c76c']::text[])
    ) expected(signature, acl, source_hashes)
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(expected.signature)
    WHERE p.oid IS NULL OR pg_get_userbyid(p.proowner)<>'postgres'
      OR p.prosecdef IS DISTINCT FROM true
      OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
      OR p.proacl IS NULL
      OR NOT (p.proacl @> expected.acl AND p.proacl <@ expected.acl)
      OR NOT (md5(p.prosrc)=ANY(expected.source_hashes))
  ) THEN
    RAISE EXCEPTION 'ESTADO_OPERATIVO_PRECONDITION: owner, ACL, seguridad, search_path o cuerpo no revisado';
  END IF;
  SELECT jsonb_agg(to_jsonb(p)-'prosrc' ORDER BY p.oid) INTO v_before
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('_dashboard_details_calc','_dashboard_summary_calc','dashboard_details_datos','dashboard_stats','dashboard_summary_datos','embarques_alertas_ids','operaciones_stats','sidebar_alert_counts');
  PERFORM set_config('elogistix.estado_operativo_catalog',v_before::text,true);
END $catalog$;

-- Estado operativo: sólo el estado persistido por la operación.
-- ETD/ETA conservan su uso de previsión; no acreditan salida ni arribo real.
-- CREATE OR REPLACE conserva propietario y ACL; no se mutan filas históricas.

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
        e.estado::text AS estado_real
      FROM embarques e
      WHERE e.deleted_at IS NULL
        AND (e.organization_id = public.org_scope())
    ),
    profit AS (SELECT * FROM profit_por_embarque()),
    -- AUD-UTIL-MES-TC: TC ponderado de las facturas USD vigentes del embarque.
    tc_factura AS (
      SELECT f.embarque_id, sum(f.subtotal * f.tipo_cambio) / NULLIF(sum(f.subtotal), 0) AS tc
      FROM facturas f
      WHERE f.deleted_at IS NULL
        AND f.organization_id = public.org_scope()
        AND f.moneda::text = 'USD' AND f.tipo_cambio > 1 AND f.subtotal > 0
        AND f.estado::text NOT IN ('Cancelada','Borrador','Sustituida')
      GROUP BY f.embarque_id
    ),
    profit_fx AS (
      SELECT p.embarque_id, p.venta_usd, p.costo_usd, p.costo_mxn,
             p.costo_mxn_from_usd, p.venta_mxn_from_eur, p.costo_mxn_from_eur,
             p.venta_mxn_native, p.costo_mxn_native,
             p.venta_usd * COALESCE(tf.tc, p.tipo_cambio_usd) AS venta_mxn_from_usd,
             p.venta_usd * COALESCE(tf.tc, p.tipo_cambio_usd) + p.venta_mxn_from_eur + p.venta_mxn_native AS venta_mxn
      FROM profit p LEFT JOIN tc_factura tf ON tf.embarque_id = p.embarque_id
    ),
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
        CASE
          WHEN pf.moneda = 'MXN' THEN pf.subtotal
          WHEN pf.moneda = 'USD' AND pf.tipo_cambio_usd > 1 THEN pf.subtotal * pf.tipo_cambio_usd
          WHEN pf.moneda = 'EUR' AND COALESCE(eb.tipo_cambio_eur, dof.eur_mxn) > 1
               THEN pf.subtotal * COALESCE(eb.tipo_cambio_eur, dof.eur_mxn)
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
      FROM embarques_base eb
      LEFT JOIN profit_fx p ON p.embarque_id = eb.id
      WHERE eb.estado_real NOT IN ('Borrador','Cancelado')
        AND eb.eta IS NOT NULL AND eb.eta >= v_inicio_mes AND eb.eta <= v_fin_mes
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
        e.estado::text AS estado_real
      FROM embarques e
      WHERE e.deleted_at IS NULL
        AND (e.organization_id = public.org_scope())
    ),
    profit AS (SELECT * FROM profit_por_embarque()),
    tc_factura AS (
      SELECT f.embarque_id, sum(f.subtotal * f.tipo_cambio) / NULLIF(sum(f.subtotal), 0) AS tc
      FROM facturas f
      WHERE f.deleted_at IS NULL
        AND f.organization_id = public.org_scope()
        AND f.moneda::text = 'USD' AND f.tipo_cambio > 1 AND f.subtotal > 0
        AND f.estado::text NOT IN ('Cancelada','Borrador','Sustituida')
      GROUP BY f.embarque_id
    ),
    profit_fx AS (
      SELECT p.embarque_id, p.venta_usd, p.costo_usd, p.costo_mxn,
             p.costo_mxn_from_usd, p.venta_mxn_from_eur, p.costo_mxn_from_eur,
             p.venta_mxn_native, p.costo_mxn_native,
             p.venta_usd * COALESCE(tf.tc, p.tipo_cambio_usd) AS venta_mxn_from_usd,
             p.venta_usd * COALESCE(tf.tc, p.tipo_cambio_usd) + p.venta_mxn_from_eur + p.venta_mxn_native AS venta_mxn
      FROM profit p LEFT JOIN tc_factura tf ON tf.embarque_id = p.embarque_id
    ),
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
      FROM embarques_base eb LEFT JOIN profit_fx p ON p.embarque_id = eb.id
      WHERE eb.estado_real NOT IN ('Borrador','Cancelado')
        AND eb.eta IS NOT NULL AND eb.eta >= v_inicio_mes AND eb.eta <= v_fin_mes
        AND (COALESCE(p.venta_mxn, 0) > 0 OR COALESCE(p.costo_mxn, 0) > 0)
      ORDER BY (COALESCE(p.venta_mxn, 0) - COALESCE(p.costo_mxn, 0)) DESC LIMIT 200
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
                 AND f.deleted_at IS NULL
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
      e.estado::text AS estado_real
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

CREATE OR REPLACE FUNCTION public.dashboard_stats() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
      e.estado::text AS estado_real
    FROM embarques e
    WHERE (e.organization_id = public.org_scope())
      AND e.deleted_at IS NULL
  ),
  profit AS (
    SELECT p.embarque_id, p.venta_usd, p.costo_usd
    FROM profit_por_embarque() p
  ),
  activos AS (
    SELECT * FROM embarques_base
    -- B-033: Borrador ya no cuenta como activo operativo.
    WHERE estado_real NOT IN ('Borrador','EIR','Por liquidar','Cerrado','Cancelado')
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
      'yaLlegaron', count(*) FILTER (WHERE eb.estado_real IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado')),
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
$$;

CREATE OR REPLACE FUNCTION public._dashboard_summary_calc() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
        e.tipo_cambio_eur,
        e.estado::text AS estado_real
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
      -- FIX BL-11: mismo fallback DOF — una factura EUR con TC DOF disponible ya
      -- no cuenta como "sin TC".
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
$$;

CREATE OR REPLACE FUNCTION public._dashboard_details_calc() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
        e.estado::text AS estado_real
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
                 -- Ola 5 · RG4-2 (N45): 'Sustituida' ya no es CFDI vigente;
                 -- excluirla del flag "facturado" (la definición vigente
                 -- sólo excluía Cancelada/Borrador).
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
$$;

CREATE OR REPLACE FUNCTION public.sidebar_alert_counts() RETURNS TABLE(embarques_demora bigint, facturas_vencidas bigint, garantias_atoradas bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    (SELECT count(*) FROM embarques e
     WHERE e.eta IS NOT NULL
       AND e.deleted_at IS NULL
       -- R220: Cancelado/Borrador nunca son demora.
       AND e.estado::text NOT IN ('Cancelado','Borrador')
       AND (current_date - e.eta) >= 7
       AND e.estado::text = 'Arribo'
       AND e.organization_id = public.org_scope()
    ) AS embarques_demora,
    (SELECT count(*) FROM facturas f
     WHERE f.estado = 'Vencida'
       AND f.deleted_at IS NULL
       AND f.organization_id = public.org_scope()
    ) AS facturas_vencidas,
    (SELECT count(*) FROM embarque_garantias_contenedor g
     JOIN embarques e ON e.id = g.embarque_id
     WHERE g.estado = 'depositado'
       AND g.deleted_at IS NULL
       AND e.deleted_at IS NULL
       AND g.fecha_deposito IS NOT NULL
       AND (current_date - g.fecha_deposito) > 30
       AND e.organization_id = public.org_scope()
    ) AS garantias_atoradas;
$$;

CREATE OR REPLACE FUNCTION public.embarques_alertas_ids() RETURNS TABLE(embarque_id uuid, tipo text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT e.id, 'demora'::text AS tipo
  FROM embarques e
  WHERE e.deleted_at IS NULL
    -- R220: Cancelado/Borrador nunca son demora.
    AND e.estado::text NOT IN ('Cancelado','Borrador')
    AND e.eta IS NOT NULL
    AND (current_date - e.eta) >= 7
    AND e.estado::text = 'Arribo'
    AND (e.organization_id = public.org_scope())
  UNION ALL
  SELECT DISTINCT e.id, 'garantia'::text
  FROM embarque_garantias_contenedor g
  JOIN embarques e ON e.id = g.embarque_id
  WHERE g.estado = 'depositado'
    AND g.fecha_deposito IS NOT NULL
    AND (current_date - g.fecha_deposito) > 30
    AND e.deleted_at IS NULL
    AND (e.organization_id = public.org_scope())
  UNION ALL
  SELECT e.id,
         CASE WHEN e.estado = 'Por liquidar' THEN 'admin_pendiente' ELSE 'cierre_operativo' END::text
  FROM embarques e
  WHERE e.deleted_at IS NULL
    AND e.estado IN ('Entregado', 'EIR', 'Por liquidar')
    AND (e.organization_id = public.org_scope())
    AND (
      EXISTS (
        SELECT 1 FROM facturas f
        WHERE f.embarque_id = e.id AND f.deleted_at IS NULL
          AND f.estado NOT IN ('Cancelada','Pagada')
        GROUP BY f.embarque_id
        HAVING SUM(f.total) > COALESCE((
          SELECT SUM(pf.monto) FROM pagos_factura pf
          JOIN facturas fi ON fi.id = pf.factura_id
          WHERE fi.embarque_id = e.id AND fi.deleted_at IS NULL
            AND fi.estado NOT IN ('Cancelada','Pagada')
        ),0) + 0.01
      )
      OR EXISTS (
        SELECT 1 FROM proveedor_facturas pf
        WHERE pf.embarque_id = e.id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
        GROUP BY pf.embarque_id
        HAVING SUM(pf.total) > COALESCE((
          SELECT SUM(pp.monto) FROM pagos_proveedor pp
          JOIN proveedor_facturas pfx ON pfx.id = pp.proveedor_factura_id
          WHERE pfx.embarque_id = e.id AND pfx.deleted_at IS NULL AND pfx.estado <> 'Cancelada'
        ),0) + 0.01
      )
      OR EXISTS (
        SELECT 1 FROM documentos_embarque de
        WHERE de.embarque_id = e.id AND de.deleted_at IS NULL
          AND (de.archivo IS NULL OR de.archivo = '')
          AND de.estado <> 'No aplica'
      )
      OR (
        COALESCE((SELECT SUM(total) FROM conceptos_venta WHERE embarque_id = e.id AND deleted_at IS NULL),0)
        > COALESCE((SELECT SUM(total) FROM facturas WHERE embarque_id = e.id AND deleted_at IS NULL AND estado <> 'Cancelada'),0) + 0.01
      )
    );
$$;

-- Reafirmación exacta de ACL existentes requerida por H6; no ampliar acceso.
REVOKE ALL ON FUNCTION public._dashboard_details_calc() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._dashboard_details_calc() TO service_role;
REVOKE ALL ON FUNCTION public._dashboard_summary_calc() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._dashboard_summary_calc() TO service_role;
REVOKE ALL ON FUNCTION public.dashboard_details_datos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_details_datos() TO service_role;
REVOKE ALL ON FUNCTION public.dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dashboard_summary_datos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_summary_datos() TO service_role;
REVOKE ALL ON FUNCTION public.embarques_alertas_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.embarques_alertas_ids() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.operaciones_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.operaciones_stats() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sidebar_alert_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sidebar_alert_counts() TO authenticated, service_role;

-- Conservar íntegro el catálogo salvo el cuerpo; sin tablas ni backfill.
DO $metadata$
DECLARE
  v_after jsonb;
BEGIN
  SELECT jsonb_agg(to_jsonb(p)-'prosrc' ORDER BY p.oid) INTO v_after
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('_dashboard_details_calc','_dashboard_summary_calc','dashboard_details_datos','dashboard_stats','dashboard_summary_datos','embarques_alertas_ids','operaciones_stats','sidebar_alert_counts');
  IF v_after IS DISTINCT FROM current_setting('elogistix.estado_operativo_catalog')::jsonb THEN
    RAISE EXCEPTION 'ESTADO_OPERATIVO_METADATA: cambió firma, owner, ACL o seguridad';
  END IF;
END $metadata$;
COMMIT;
