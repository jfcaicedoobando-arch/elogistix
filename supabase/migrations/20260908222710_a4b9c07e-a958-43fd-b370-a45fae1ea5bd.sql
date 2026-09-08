DROP FUNCTION IF EXISTS public.profit_por_cliente(date, date, text);

CREATE OR REPLACE FUNCTION public.profit_por_cliente(
  _fecha_desde date DEFAULT NULL::date,
  _fecha_hasta date DEFAULT NULL::date,
  _modo text DEFAULT NULL::text,
  _cliente_id uuid DEFAULT NULL::uuid
)
 RETURNS TABLE(cliente_id uuid, cliente_nombre text, total_embarques bigint, venta_usd numeric, costo_usd numeric, venta_mxn numeric, costo_mxn numeric, embarques_sin_tc bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      e.id,
      e.cliente_id,
      e.cliente_nombre,
      COALESCE(
        NULLIF(e.tipo_cambio_usd, 0),
        (SELECT d.usd_mxn FROM public.tc_dof_vigente(COALESCE(e.eta, e.etd, e.created_at::date)) d)
      ) AS tc_usd,
      COALESCE(
        NULLIF(e.tipo_cambio_eur, 0),
        (SELECT d.eur_mxn FROM public.tc_dof_vigente(COALESCE(e.eta, e.etd, e.created_at::date)) d)
      ) AS tc_eur
    FROM public.embarques e
    WHERE e.deleted_at IS NULL
      AND (_fecha_desde IS NULL OR e.eta >= _fecha_desde)
      AND (_fecha_hasta IS NULL OR e.eta <= _fecha_hasta)
      AND (_modo IS NULL OR e.modo::text = _modo)
      AND (_cliente_id IS NULL OR e.cliente_id = _cliente_id)
      AND (e.organization_id = public.org_scope())
  ),
  ventas AS (
    SELECT
      cv.embarque_id,
      SUM(public.a_mxn(cv.total, cv.moneda::text, b.tc_usd, b.tc_eur)) AS venta_mxn,
      COUNT(*) FILTER (
        WHERE public.a_mxn(cv.total, cv.moneda::text, b.tc_usd, b.tc_eur) IS NULL
      ) AS venta_sin_tc
    FROM public.conceptos_venta cv
    JOIN base b ON b.id = cv.embarque_id
    WHERE cv.deleted_at IS NULL
    GROUP BY cv.embarque_id
  ),
  -- M1 residual: notas de crédito aplicadas por embarque, convertidas a MXN
  -- con el mismo TC resuelto del embarque. Canon único:
  -- nc_aplicadas_en_moneda_factura (delegación a _nc_aplicadas_moneda_factura).
  ncs AS (
    SELECT
      fe.embarque_id,
      SUM(
        COALESCE(
          public.a_mxn(
            public.nc_aplicadas_en_moneda_factura(f.id),
            f.moneda::text, b.tc_usd, b.tc_eur
          ), 0)
      ) AS nc_mxn
    FROM public.factura_embarques fe
    JOIN base b ON b.id = fe.embarque_id
    JOIN public.facturas f ON f.id = fe.factura_id
    WHERE fe.activa IS TRUE
      AND f.deleted_at IS NULL
      AND f.estado <> 'Cancelada'::estado_factura
    GROUP BY fe.embarque_id
  ),
  costos AS (
    SELECT
      cc.embarque_id,
      SUM(public.a_mxn(cc.monto, cc.moneda::text, b.tc_usd, b.tc_eur)) AS costo_mxn,
      COUNT(*) FILTER (
        WHERE public.a_mxn(cc.monto, cc.moneda::text, b.tc_usd, b.tc_eur) IS NULL
      ) AS costo_sin_tc
    FROM public.conceptos_costo cc
    JOIN base b ON b.id = cc.embarque_id
    WHERE cc.deleted_at IS NULL
    GROUP BY cc.embarque_id
  ),
  neto AS (
    SELECT
      b.id,
      b.cliente_id,
      b.cliente_nombre,
      b.tc_usd,
      GREATEST(COALESCE(v.venta_mxn, 0) - COALESCE(nc.nc_mxn, 0), 0) AS venta_mxn,
      COALESCE(c.costo_mxn, 0) AS costo_mxn,
      COALESCE(v.venta_sin_tc, 0) AS venta_sin_tc,
      COALESCE(c.costo_sin_tc, 0) AS costo_sin_tc
    FROM base b
    LEFT JOIN ventas v ON v.embarque_id = b.id
    LEFT JOIN costos c ON c.embarque_id = b.id
    LEFT JOIN ncs   nc ON nc.embarque_id = b.id
  )
  SELECT
    n.cliente_id,
    MAX(n.cliente_nombre) AS cliente_nombre,
    COUNT(DISTINCT n.id) AS total_embarques,
    COALESCE(SUM(
      CASE WHEN COALESCE(n.tc_usd, 0) > 0
        THEN round(n.venta_mxn / n.tc_usd, 4) END
    ), 0) AS venta_usd,
    COALESCE(SUM(
      CASE WHEN COALESCE(n.tc_usd, 0) > 0
        THEN round(n.costo_mxn / n.tc_usd, 4) END
    ), 0) AS costo_usd,
    COALESCE(SUM(n.venta_mxn), 0) AS venta_mxn,
    COALESCE(SUM(n.costo_mxn), 0) AS costo_mxn,
    COUNT(DISTINCT n.id) FILTER (
      WHERE COALESCE(n.tc_usd, 0) <= 0
         OR n.venta_sin_tc > 0
         OR n.costo_sin_tc > 0
    ) AS embarques_sin_tc
  FROM neto n
  GROUP BY n.cliente_id;
$function$;

REVOKE ALL ON FUNCTION public.profit_por_cliente(date, date, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profit_por_cliente(date, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profit_por_cliente(date, date, text, uuid) TO service_role;