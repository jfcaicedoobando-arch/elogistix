CREATE OR REPLACE FUNCTION public._bitacora_facturas_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado
     AND NEW.estado IN ('Emitida', 'Cancelada', 'Sustituida') THEN
    PERFORM public.registrar_bitacora(
      'facturacion',
      CASE NEW.estado
        WHEN 'Emitida' THEN 'timbrar_factura'
        WHEN 'Cancelada' THEN 'cancelar_factura'
        ELSE 'sustituir_factura'
      END,
      NEW.id,
      COALESCE(NEW.folio_completo, ''),
      jsonb_build_object(
        'estado_anterior', OLD.estado::text,
        'estado_nuevo', NEW.estado::text,
        'uuid_fiscal', NEW.uuid_fiscal
      ),
      NEW.organization_id,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bitacora_facturas_estado ON public.facturas;
CREATE TRIGGER trg_bitacora_facturas_estado
AFTER UPDATE OF estado ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public._bitacora_facturas_estado();