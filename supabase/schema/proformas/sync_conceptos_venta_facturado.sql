-- Fuente canónica. Forward: 20261006233000_proforma_operativa_compatibilidad.sql.
CREATE OR REPLACE FUNCTION public.sync_conceptos_venta_facturado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_bypass_prev text;
BEGIN
  v_bypass_prev := current_setting('app.bypass_cierre', true);
  BEGIN
    PERFORM set_config('app.bypass_cierre', 'on', true);
    IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      UPDATE public.conceptos_venta
         SET estado_facturacion = 'pendiente',
             proforma_id = NULL
       WHERE proforma_id = NEW.id
         AND deleted_at IS NULL;
    ELSIF TG_OP = 'UPDATE' AND NEW.estado_proforma IS DISTINCT FROM OLD.estado_proforma THEN
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
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
    RAISE;
  END;
  RETURN NEW;
END;
$$;
