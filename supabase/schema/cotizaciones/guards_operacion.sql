CREATE OR REPLACE FUNCTION public.cotizaciones_guard_en_operacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- QA-R2 R-04: procesos internos de sincronización (p.ej.
  -- recalcular_subtotal_cotizacion) levantan esta GUC transaccional.
  IF current_setting('app.cotizacion_sync', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF (OLD.estado = 'En operación'::public.estado_cotizacion OR OLD.embarque_id IS NOT NULL)
     AND (NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.moneda IS DISTINCT FROM OLD.moneda
       OR NEW.conceptos_venta IS DISTINCT FROM OLD.conceptos_venta) THEN
    RAISE EXCEPTION 'LC_COTIZACION_EN_OPERACION: los importes y conceptos ya están vinculados a una operación'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_cotizaciones_guard_en_operacion ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_guard_en_operacion
BEFORE UPDATE ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public.cotizaciones_guard_en_operacion();