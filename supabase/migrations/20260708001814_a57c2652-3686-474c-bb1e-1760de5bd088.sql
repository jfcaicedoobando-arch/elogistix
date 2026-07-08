
-- Trigger de propagación (usa app.bypass_cierre para no chocar con tg_bloquear_si_embarque_cerrado)
CREATE OR REPLACE FUNCTION public.sync_conceptos_venta_facturado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bypass_cierre', 'on', true);

  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.conceptos_venta
       SET estado_facturacion = 'pendiente',
           proforma_id = NULL
     WHERE proforma_id = NEW.id
       AND deleted_at IS NULL;
    PERFORM set_config('app.bypass_cierre', 'off', true);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.estado_proforma IS DISTINCT FROM OLD.estado_proforma THEN
    IF NEW.estado_proforma = 'facturada' THEN
      UPDATE public.conceptos_venta
         SET estado_facturacion = 'facturado'
       WHERE proforma_id = NEW.id
         AND deleted_at IS NULL
         AND estado_facturacion <> 'facturado';
    ELSIF NEW.estado_proforma = 'pendiente' AND OLD.estado_proforma = 'facturada' THEN
      UPDATE public.conceptos_venta
         SET estado_facturacion = 'en_proforma'
       WHERE proforma_id = NEW.id
         AND deleted_at IS NULL
         AND estado_facturacion = 'facturado';
    END IF;
  END IF;

  PERFORM set_config('app.bypass_cierre', 'off', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conceptos_venta_facturado ON public.proformas;
CREATE TRIGGER trg_sync_conceptos_venta_facturado
AFTER UPDATE ON public.proformas
FOR EACH ROW EXECUTE FUNCTION public.sync_conceptos_venta_facturado();

-- Backfill: 463 conceptos con proforma ya facturada
DO $$
BEGIN
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.conceptos_venta cv
     SET estado_facturacion = 'facturado'
    FROM public.proformas p
   WHERE p.id = cv.proforma_id
     AND p.estado_proforma = 'facturada'
     AND p.deleted_at IS NULL
     AND cv.deleted_at IS NULL
     AND cv.estado_facturacion <> 'facturado';
  PERFORM set_config('app.bypass_cierre', 'off', true);
END $$;
