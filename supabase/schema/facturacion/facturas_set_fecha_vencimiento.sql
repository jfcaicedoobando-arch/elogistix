-- Fuente canónica de public.facturas_set_fecha_vencimiento (trigger de public.facturas).
-- Cada cambio DEBE actualizarse aquí en el mismo PR que la migración correspondiente.
-- Ver supabase/schema/README.md.
--
-- v13.331.9 — antes sólo calculaba el vencimiento cuando venía NULL, por lo que
-- editar `dias_credito` en un borrador dejaba la fecha de vencimiento desfasada
-- (ej. factura con 60 días venciendo el mismo día de emisión). Ahora recalcula
-- en cada UPDATE de `fecha_emision` o `dias_credito`, y respeta una fecha de
-- vencimiento fijada explícitamente por el caller en la misma sentencia.

CREATE OR REPLACE FUNCTION public.facturas_set_fecha_vencimiento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fecha_emision IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.fecha_vencimiento IS NULL THEN
      NEW.fecha_vencimiento := NEW.fecha_emision + COALESCE(NEW.dias_credito, 0);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: si el caller fijó explícitamente un vencimiento distinto, se respeta.
  IF NEW.fecha_vencimiento IS DISTINCT FROM OLD.fecha_vencimiento THEN
    IF NEW.fecha_vencimiento IS NULL THEN
      NEW.fecha_vencimiento := NEW.fecha_emision + COALESCE(NEW.dias_credito, 0);
    END IF;
    RETURN NEW;
  END IF;

  -- Recalcular cuando cambia la emisión o los días de crédito.
  IF NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision
     OR NEW.dias_credito IS DISTINCT FROM OLD.dias_credito THEN
    NEW.fecha_vencimiento := NEW.fecha_emision + COALESCE(NEW.dias_credito, 0);
  END IF;

  RETURN NEW;
END;
$function$;

-- CREATE TRIGGER trg_facturas_set_fecha_vencimiento
--   BEFORE INSERT OR UPDATE OF fecha_emision, dias_credito ON public.facturas
--   FOR EACH ROW EXECUTE FUNCTION public.facturas_set_fecha_vencimiento();
