-- Fuente canónica de public.direccion_totales(...) (Ola 6 · O6-SCHEMA).
-- 1:1 con supabase/migrations/20260818090100_ola5_rg413_n23_cartera_direccion_canon.sql.
-- Ola 5 · N23: totales de dirección.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.direccion_totales(
  p_desde date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH emb AS (
    SELECT e.id
    FROM embarques e
    WHERE e.deleted_at IS NULL
      -- Ola 5 · N23: excluir Cancelado, alineado con el loader cliente
      -- del dashboard de Dirección.
      AND e.estado <> 'Cancelado'
      AND (e.cerrado_at >= p_desde OR e.eta >= p_desde)
      AND e.organization_id = public.org_scope()
  ),
  ventas AS (
    SELECT cv.moneda::text AS moneda, SUM(cv.total) AS total
    FROM conceptos_venta cv
    WHERE cv.deleted_at IS NULL AND cv.embarque_id IN (SELECT id FROM emb)
    GROUP BY cv.moneda
  ),
  costos AS (
    SELECT cc.moneda::text AS moneda, SUM(cc.monto) AS total
    FROM conceptos_costo cc
    WHERE cc.deleted_at IS NULL AND cc.embarque_id IN (SELECT id FROM emb)
    GROUP BY cc.moneda
  ),
  facturado AS (
    SELECT f.moneda::text AS moneda, SUM(f.total) AS total
    FROM facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.fecha_emision >= p_desde
      AND f.organization_id = public.org_scope()
    GROUP BY f.moneda
  ),
  cobrado AS (
    SELECT f.moneda::text AS moneda, SUM(pf.monto_aplicado_factura) AS total
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND pf.fecha_pago >= p_desde
      AND pf.organization_id = public.org_scope()
    GROUP BY f.moneda
  )
  SELECT jsonb_build_object(
    'embarques',  (SELECT COUNT(*) FROM emb),
    'ventas',     COALESCE((SELECT jsonb_object_agg(moneda, total) FROM ventas), '{}'::jsonb),
    'costos',     COALESCE((SELECT jsonb_object_agg(moneda, total) FROM costos), '{}'::jsonb),
    'facturado',  COALESCE((SELECT jsonb_object_agg(moneda, total) FROM facturado), '{}'::jsonb),
    'cobrado',    COALESCE((SELECT jsonb_object_agg(moneda, total) FROM cobrado), '{}'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.direccion_totales(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direccion_totales(date) TO authenticated;
