-- Fase R.4 (Bug 24): guarda BD para pagos a proveedor.
-- Impide INSERT o "revivir" un pago si la factura asociada no está APROBADA.

CREATE OR REPLACE FUNCTION public.check_pago_proveedor_factura_aprobada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado public.estado_aprobacion_factura_proveedor;
  v_folio text;
BEGIN
  -- Sólo aplicar en INSERT o cuando un UPDATE está reactivando un pago
  -- (pasando de deleted_at NOT NULL -> NULL).
  IF TG_OP = 'UPDATE' THEN
    IF NOT (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT estado_aprobacion, folio_proveedor
    INTO v_estado, v_folio
  FROM public.proveedor_facturas
  WHERE id = NEW.proveedor_factura_id;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_APROBACION: factura de proveedor % no encontrada', NEW.proveedor_factura_id;
  END IF;

  IF v_estado <> 'aprobada' THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_APROBACION: la factura % está en estado % y no admite pagos', COALESCE(v_folio, NEW.proveedor_factura_id::text), v_estado;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pago_requiere_aprobacion ON public.pagos_proveedor;

CREATE TRIGGER trg_pago_requiere_aprobacion
BEFORE INSERT OR UPDATE OF deleted_at ON public.pagos_proveedor
FOR EACH ROW
EXECUTE FUNCTION public.check_pago_proveedor_factura_aprobada();