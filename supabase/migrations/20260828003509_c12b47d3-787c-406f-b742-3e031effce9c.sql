-- Ola 6 · M1 (auditoría 3): `profit_por_cliente` dividía entre
-- `e.tipo_cambio_usd` sin defensa: NULL/0 hacía desaparecer (o reventar) los
-- conceptos MXN del embarque, dando utilidades por cliente incompletas
-- presentadas como exactas. Ahora se resuelve el TC con fallback al DOF de la
-- fecha del embarque y se reporta cuántos embarques quedaron sin TC.
DROP FUNCTION IF EXISTS public.profit_por_cliente(date, date, text);

CREATE OR REPLACE FUNCTION public.profit_por_cliente(
  _fecha_desde date DEFAULT NULL::date,
  _fecha_hasta date DEFAULT NULL::date,
  _modo text DEFAULT NULL::text
)
RETURNS TABLE(
  cliente_id uuid,
  cliente_nombre text,
  total_embarques bigint,
  venta_usd numeric,
  costo_usd numeric,
  venta_mxn numeric,
  costo_mxn numeric,
  embarques_sin_tc bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      e.id,
      e.cliente_id,
      e.cliente_nombre,
      -- TC del embarque; si falta o es 0, el DOF vigente a la fecha del
      -- embarque (ETA, o ETD/creación si no hay ETA).
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
  )
  SELECT
    b.cliente_id,
    MAX(b.cliente_nombre) AS cliente_nombre,
    COUNT(DISTINCT b.id) AS total_embarques,
    -- USD equivalente: se deriva del MXN con el mismo TC resuelto, sin
    -- colapsar nunca a 1 (política anti "TC=1 silencioso").
    COALESCE(SUM(
      CASE WHEN COALESCE(b.tc_usd, 0) > 0
        THEN round(COALESCE(v.venta_mxn, 0) / b.tc_usd, 4) END
    ), 0) AS venta_usd,
    COALESCE(SUM(
      CASE WHEN COALESCE(b.tc_usd, 0) > 0
        THEN round(COALESCE(c.costo_mxn, 0) / b.tc_usd, 4) END
    ), 0) AS costo_usd,
    COALESCE(SUM(COALESCE(v.venta_mxn, 0)), 0) AS venta_mxn,
    COALESCE(SUM(COALESCE(c.costo_mxn, 0)), 0) AS costo_mxn,
    COUNT(DISTINCT b.id) FILTER (
      WHERE COALESCE(b.tc_usd, 0) <= 0
         OR COALESCE(v.venta_sin_tc, 0) > 0
         OR COALESCE(c.costo_sin_tc, 0) > 0
    ) AS embarques_sin_tc
  FROM base b
  LEFT JOIN ventas v ON v.embarque_id = b.id
  LEFT JOIN costos c ON c.embarque_id = b.id
  GROUP BY b.cliente_id;
$$;

REVOKE ALL ON FUNCTION public.profit_por_cliente(date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profit_por_cliente(date, date, text) TO authenticated, service_role;