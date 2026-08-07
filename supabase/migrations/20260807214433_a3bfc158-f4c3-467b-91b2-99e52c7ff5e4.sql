CREATE OR REPLACE FUNCTION public._bitacora_facturas_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      COALESCE(NULLIF(TRIM(CONCAT_WS('-', NEW.serie, NEW.numero::text)), ''), ''),
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
$$;

REVOKE ALL ON FUNCTION public._bitacora_facturas_estado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bitacora_facturas_estado() TO service_role;