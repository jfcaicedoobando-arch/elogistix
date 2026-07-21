-- v13.303.97: Reversión automática de ajustes de costo cuando se cancela o elimina la factura de proveedor.
-- Los ajustes son `conceptos_costo` con `origen = 'ajuste_factura_proveedor'` creados por
-- `crearAjustesFacturaProveedor` cuando el monto facturado difiere del devengado.
-- Sin esta reversión, cancelar una factura con descuento dejaría al embarque con utilidad falsamente inflada.

CREATE OR REPLACE FUNCTION public.tg_reverse_ajustes_factura_proveedor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_reverse boolean := false;
BEGIN
  -- Transición a Cancelada (desde cualquier otro estado)
  IF NEW.estado = 'Cancelada' AND (OLD.estado IS DISTINCT FROM 'Cancelada') THEN
    v_should_reverse := true;
  END IF;
  -- Soft-delete de la factura
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    v_should_reverse := true;
  END IF;

  IF v_should_reverse THEN
    UPDATE public.conceptos_costo cc
    SET deleted_at = now(),
        deleted_by = NEW.deleted_by
    WHERE cc.deleted_at IS NULL
      AND cc.origen = 'ajuste_factura_proveedor'
      AND cc.id IN (
        SELECT pfc.concepto_costo_id
        FROM public.proveedor_facturas_conceptos pfc
        WHERE pfc.proveedor_factura_id = NEW.id
          AND pfc.concepto_costo_id IS NOT NULL
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_ajustes_factura_proveedor ON public.proveedor_facturas;
CREATE TRIGGER trg_reverse_ajustes_factura_proveedor
AFTER UPDATE ON public.proveedor_facturas
FOR EACH ROW
WHEN (
  (NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado = 'Cancelada')
  OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL)
)
EXECUTE FUNCTION public.tg_reverse_ajustes_factura_proveedor();

COMMENT ON FUNCTION public.tg_reverse_ajustes_factura_proveedor() IS
  'v13.303.97: Al cancelar o eliminar una factura de proveedor, soft-deletea los conceptos_costo con origen=ajuste_factura_proveedor asociados a ella, para que la utilidad del embarque revierta al costo devengado.';