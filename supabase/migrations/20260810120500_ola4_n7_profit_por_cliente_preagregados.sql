-- Ola 4 · N7: profit_por_cliente sin fan-out.
--
-- N7 (ALTA): el join plano embarques×conceptos_venta×conceptos_costo
--     generaba V×C filas por embarque — cada venta se sumaba C veces y cada
--     costo V veces. Se preagrega cada lado por embarque_id en CTEs
--     separadas (patrón de profit_por_embarque, 20260725174719) y se joinea
--     1:1 contra la base. Las CTEs joinean contra `base` (ya acotada por
--     org + deleted_at): predicado org que faltaba en los joins de
--     conceptos y cierra en lectura el vector de N6.
--
-- Conserva: firma y retorno idénticos, filtros de fecha/modo/org (org_scope()
-- vigente en BD), FIX C5 (deleted_at en embarques y en ambos lados de
-- conceptos) y la fórmula de conversión por fila (USD directo; MXN/tc_usd;
-- EUR*tc_eur/tc_usd; TC NULL ⇒ la fila no suma). GROUP BY se mantiene por
-- (cliente_id, cliente_nombre) igual que la versión vigente (fuera de
-- alcance de este fix).
CREATE OR REPLACE FUNCTION public.profit_por_cliente(
  _fecha_desde date DEFAULT NULL::date,
  _fecha_hasta date DEFAULT NULL::date,
  _modo text DEFAULT NULL::text
)
RETURNS TABLE(cliente_id uuid, cliente_nombre text, total_embarques bigint, venta_usd numeric, costo_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT e.id, e.cliente_id, e.cliente_nombre, e.tipo_cambio_usd, e.tipo_cambio_eur
    FROM embarques e
    WHERE e.deleted_at IS NULL                  -- FIX C5
      AND (_fecha_desde IS NULL OR e.eta >= _fecha_desde)
      AND (_fecha_hasta IS NULL OR e.eta <= _fecha_hasta)
      AND (_modo IS NULL OR e.modo::text = _modo)
      AND (e.organization_id = public.org_scope())
  ),
  -- Ola 4 · N7: preagregado por embarque (sin fan-out). El JOIN contra base
  -- acota los conceptos a la org del caller (Ola 4 · N6, vector de lectura).
  ventas AS (
    SELECT cv.embarque_id,
      SUM(CASE cv.moneda WHEN 'USD' THEN cv.total WHEN 'MXN' THEN cv.total / b.tipo_cambio_usd WHEN 'EUR' THEN (cv.total * b.tipo_cambio_eur) / b.tipo_cambio_usd ELSE 0 END) AS venta_usd
    FROM conceptos_venta cv
    JOIN base b ON b.id = cv.embarque_id
    WHERE cv.deleted_at IS NULL                 -- FIX C5
    GROUP BY cv.embarque_id
  ),
  costos AS (
    SELECT cc.embarque_id,
      SUM(CASE cc.moneda WHEN 'USD' THEN cc.monto WHEN 'MXN' THEN cc.monto / b.tipo_cambio_usd WHEN 'EUR' THEN (cc.monto * b.tipo_cambio_eur) / b.tipo_cambio_usd ELSE 0 END) AS costo_usd
    FROM conceptos_costo cc
    JOIN base b ON b.id = cc.embarque_id
    WHERE cc.deleted_at IS NULL                 -- FIX C5
    GROUP BY cc.embarque_id
  )
  SELECT
    b.cliente_id,
    b.cliente_nombre,
    COUNT(DISTINCT b.id) AS total_embarques,
    COALESCE(SUM(v.venta_usd), 0) AS venta_usd,
    COALESCE(SUM(c.costo_usd), 0) AS costo_usd
  FROM base b
  LEFT JOIN ventas v ON v.embarque_id = b.id
  LEFT JOIN costos c ON c.embarque_id = b.id
  GROUP BY b.cliente_id, b.cliente_nombre;
$function$;

-- H6: permisos explícitos (idempotente).
REVOKE ALL ON FUNCTION public.profit_por_cliente(date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profit_por_cliente(date, date, text) TO authenticated, service_role;
