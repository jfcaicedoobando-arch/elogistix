-- AUD-ANALISIS-8: fuente única de la VENTA de un embarque = facturas timbradas
-- vigentes (sin IVA) menos sus notas de crédito timbradas (sin IVA, prorrateadas
-- por subtotal/total). Embarque sin factura vigente = venta 0. El costo no cambia.
CREATE OR REPLACE FUNCTION public._venta_facturada_por_embarque(p_org uuid)
RETURNS TABLE(embarque_id uuid, moneda text, venta_doc numeric, venta_mxn numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
  WITH f AS (
    SELECT f.id, f.embarque_id AS emb_directo, f.moneda::text AS moneda, f.tipo_cambio,
           f.subtotal * (1 - LEAST(COALESCE(public._nc_aplicadas_moneda_factura(f.id), 0)
                                   / NULLIF(f.total, 0), 1)) AS neto_doc
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.organization_id = p_org
      AND f.estado IN ('Emitida'::estado_factura, 'Pagada'::estado_factura,
                       'Parcialmente pagada'::estado_factura, 'Vencida'::estado_factura)
  ),
  por_concepto AS (
    SELECT cf.factura_id, cf.embarque_id, SUM(COALESCE(cf.total, 0)) AS w
    FROM public.conceptos_factura cf JOIN f ON f.id = cf.factura_id
    WHERE cf.deleted_at IS NULL AND cf.embarque_id IS NOT NULL
    GROUP BY 1, 2
  ),
  por_vinculo AS (
    SELECT fe.factura_id, fe.embarque_id, 1::numeric AS w
    FROM public.factura_embarques fe JOIN f ON f.id = fe.factura_id
    WHERE fe.activa IS TRUE
      AND NOT EXISTS (SELECT 1 FROM por_concepto pc WHERE pc.factura_id = fe.factura_id)
  ),
  directo AS (
    SELECT f.id AS factura_id, f.emb_directo AS embarque_id, 1::numeric AS w
    FROM f
    WHERE f.emb_directo IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM por_concepto pc WHERE pc.factura_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM por_vinculo pv WHERE pv.factura_id = f.id)
  ),
  reparto AS (
    SELECT x.factura_id, x.embarque_id,
           x.w / NULLIF(SUM(x.w) OVER (PARTITION BY x.factura_id), 0) AS parte
    FROM (SELECT * FROM por_concepto UNION ALL SELECT * FROM por_vinculo
          UNION ALL SELECT * FROM directo) x
  )
  SELECT r.embarque_id, f.moneda,
         SUM(f.neto_doc * COALESCE(r.parte, 0)) AS venta_doc,
         SUM(CASE WHEN f.moneda = 'MXN' THEN f.neto_doc * COALESCE(r.parte, 0)
                  WHEN COALESCE(f.tipo_cambio, 0) > 1 THEN f.neto_doc * COALESCE(r.parte, 0) * f.tipo_cambio
             END) AS venta_mxn
  FROM reparto r JOIN f ON f.id = r.factura_id
  GROUP BY r.embarque_id, f.moneda;
$fn$;
REVOKE ALL ON FUNCTION public._venta_facturada_por_embarque(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._venta_facturada_por_embarque(uuid) TO service_role;

-- Versión para la app: siempre acotada a la organización activa.
CREATE OR REPLACE FUNCTION public.venta_facturada_embarques(p_embarque_ids uuid[])
RETURNS TABLE(embarque_id uuid, moneda text, venta_doc numeric, venta_mxn numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
  SELECT v.embarque_id, v.moneda, v.venta_doc, v.venta_mxn
  FROM public._venta_facturada_por_embarque(public.org_scope()) v
  WHERE v.embarque_id = ANY(p_embarque_ids);
$fn$;
REVOKE ALL ON FUNCTION public.venta_facturada_embarques(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venta_facturada_embarques(uuid[]) TO authenticated, service_role;

DO $mig$
DECLARE d text; n text;
BEGIN
  -- profit_por_embarque (lo usa el Tablero)
  d := pg_get_functiondef('public.profit_por_embarque()'::regprocedure);
  n := regexp_replace(d, 'ventas AS \(.*?GROUP BY cv\.embarque_id\s*\),',
$r$ventas AS (
    SELECT v.embarque_id,
      SUM(v.venta_doc) FILTER (WHERE v.moneda = 'USD') AS venta_usd_raw,
      SUM(v.venta_doc) FILTER (WHERE v.moneda = 'EUR') AS venta_eur_raw,
      SUM(v.venta_doc) FILTER (WHERE v.moneda = 'MXN') AS venta_mxn_raw,
      SUM(v.venta_mxn) FILTER (WHERE v.moneda = 'USD') AS venta_usd_mxn,
      SUM(v.venta_mxn) FILTER (WHERE v.moneda = 'EUR') AS venta_eur_mxn
    FROM public._venta_facturada_por_embarque(public.org_scope()) v
    GROUP BY v.embarque_id
  ),$r$);
  n := replace(n, 'COALESCE(v.venta_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0)', 'COALESCE(v.venta_usd_mxn, 0)');
  n := replace(n, 'COALESCE(v.venta_eur_raw, 0) * COALESCE(e.tipo_cambio_eur, 0)', 'COALESCE(v.venta_eur_mxn, 0)');
  IF n = d OR n LIKE '%conceptos_venta%' THEN RAISE EXCEPTION 'AUD-ANALISIS-8: profit_por_embarque'; END IF;
  EXECUTE n;

  -- profit_por_cliente (Rentabilidad)
  d := pg_get_functiondef('public.profit_por_cliente(date,date,text,uuid)'::regprocedure);
  n := regexp_replace(d, 'ventas AS \(.*?GROUP BY cv\.embarque_id\s*\),',
$r$ventas AS (
    SELECT v.embarque_id, SUM(v.venta_mxn) AS venta_mxn,
      COUNT(*) FILTER (WHERE v.venta_mxn IS NULL) AS venta_sin_tc
    FROM public._venta_facturada_por_embarque(public.org_scope()) v
    JOIN base b ON b.id = v.embarque_id
    GROUP BY v.embarque_id
  ),$r$);
  -- Las NC ya vienen restadas en la venta facturada.
  n := regexp_replace(n, 'ncs AS \(.*?GROUP BY fe\.embarque_id\s*\),',
    'ncs AS (SELECT NULL::uuid AS embarque_id, 0::numeric AS nc_mxn WHERE false),');
  IF n = d OR n LIKE '%conceptos_venta%' THEN RAISE EXCEPTION 'AUD-ANALISIS-8: profit_por_cliente'; END IF;
  EXECUTE n;

  -- direccion_totales (Tablero de dirección)
  d := pg_get_functiondef('public.direccion_totales(date)'::regprocedure);
  n := regexp_replace(d, 'ventas AS \(.*?GROUP BY cv\.moneda\s*\),',
$r$ventas AS (
    SELECT v.moneda, SUM(v.venta_doc) AS total
    FROM public._venta_facturada_por_embarque(public.org_scope()) v
    WHERE v.embarque_id IN (SELECT id FROM emb)
    GROUP BY v.moneda
  ),$r$);
  IF n = d OR n LIKE '%conceptos_venta%' THEN RAISE EXCEPTION 'AUD-ANALISIS-8: direccion_totales'; END IF;
  EXECUTE n;

  -- eerr_resumen_anual, fuente por embarque (mes del embarque)
  d := pg_get_functiondef('public.eerr_resumen_anual(integer,text)'::regprocedure);
  n := regexp_replace(d, 'ing AS \(.*?GROUP BY em\.mes\s*\),',
$r$ing AS (
      SELECT em.mes, SUM(v.venta_mxn) AS total,
        COUNT(*) FILTER (WHERE v.venta_mxn IS NULL) AS sin_tc
      FROM public._venta_facturada_por_embarque(v_org) v
      JOIN emb em ON em.id = v.embarque_id
      GROUP BY em.mes
    ),$r$);
  IF n = d OR n LIKE '%conceptos_venta%' THEN RAISE EXCEPTION 'AUD-ANALISIS-8: eerr_resumen_anual'; END IF;
  EXECUTE n;
END
$mig$;