
-- 1) Trigger: requiere aprobación antes de registrar pago a proveedor
CREATE OR REPLACE FUNCTION public.tg_pagos_proveedor_requiere_aprobacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
BEGIN
  SELECT estado_aprobacion::text INTO v_estado
  FROM public.proveedor_facturas
  WHERE id = NEW.proveedor_factura_id;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'Factura de proveedor no encontrada';
  END IF;

  IF v_estado <> 'aprobada' THEN
    RAISE EXCEPTION 'La factura debe estar aprobada para registrar pagos (estado actual: %)', v_estado
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pagos_proveedor_requiere_aprobacion ON public.pagos_proveedor;
CREATE TRIGGER pagos_proveedor_requiere_aprobacion
  BEFORE INSERT ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.tg_pagos_proveedor_requiere_aprobacion();

-- 2) Backfill: facturas con pagos previos quedan aprobadas
UPDATE public.proveedor_facturas pf
SET estado_aprobacion = 'aprobada',
    aprobada_at = COALESCE(aprobada_at, now())
WHERE estado_aprobacion = 'pendiente'
  AND EXISTS (
    SELECT 1 FROM public.pagos_proveedor pp
    WHERE pp.proveedor_factura_id = pf.id
      AND pp.deleted_at IS NULL
  );

-- 3) RPC: conteo de facturas pendientes de aprobación (org del usuario)
CREATE OR REPLACE FUNCTION public.cxp_pendientes_aprobacion_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.proveedor_facturas pf
  WHERE pf.deleted_at IS NULL
    AND pf.estado <> 'Cancelada'
    AND pf.estado_aprobacion = 'pendiente'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = pf.organization_id
        AND om.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.cxp_pendientes_aprobacion_count() TO authenticated;
