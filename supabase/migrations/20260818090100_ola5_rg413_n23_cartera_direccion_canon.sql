-- Ola 5 · RG4-13 — NO-OP documentado (fix de drift, 2026-08-14).
--
-- Este bloque redefinía public.cartera_pendiente() con CREATE OR REPLACE y la
-- firma de 15 columnas de salida (sin cancellation_status). En una base limpia
-- la migración 20260813230758 (posterior en contenido, ANTERIOR en timestamp)
-- ya crea la función con 16 columnas vía DROP + CREATE, así que este
-- CREATE OR REPLACE abortaba con 42P13 ("cannot change return type").
--
-- El objetivo original de RG4-13 (quitar el filtro extra por org del cliente)
-- ya está incluido en el cuerpo canónico de 20260813230758 y en
-- supabase/schema/facturacion/cartera_pendiente.sql. Por eso aquí no se toca
-- la función: sólo se conserva la parte de N23 (direccion_totales).

-- Ola 5 · N23: direccion_totales excluye embarques Cancelado. El loader
--   cliente del dashboard de Dirección ya los excluía, pero la RPC los
--   seguía sumando a embarques/ventas/costos → totales contradictorios.
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
      AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
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
      AND (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    GROUP BY f.moneda
  ),
  cobrado AS (
    SELECT f.moneda::text AS moneda, SUM(pf.monto_aplicado_factura) AS total
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND pf.fecha_pago >= p_desde
      AND (pf.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
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