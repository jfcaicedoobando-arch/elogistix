-- Fuente canónica. Forward: 20261006230000_proforma_operativa_consistencia.sql.
CREATE OR REPLACE FUNCTION public.sync_conceptos_venta_facturado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET "app.bypass_cierre" TO 'on'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.conceptos_venta
       SET estado_facturacion = 'pendiente',
           proforma_id = NULL
     WHERE proforma_id = NEW.id
       AND deleted_at IS NULL;
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
  RETURN NEW;
END;
$$;
