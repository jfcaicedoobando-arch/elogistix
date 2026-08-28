CREATE OR REPLACE FUNCTION public.bloquear_modificacion_factura_emitida()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.snapshot_emision IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.estado = 'Cancelada' AND OLD.estado <> 'Cancelada' THEN
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- OLA 1 · C8 + Ola E1 · C8-res: la identidad fiscal (UUID SAT, id del PAC,
  -- artefactos XML/PDF y fecha de timbrado) sólo puede escribirla el servidor
  -- (webhook/edge con credencial de servicio).
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.uuid_fiscal IS DISTINCT FROM OLD.uuid_fiscal
     OR NEW.facturapi_id IS DISTINCT FROM OLD.facturapi_id
     OR NEW.factura_xml_url IS DISTINCT FROM OLD.factura_xml_url
     OR NEW.factura_pdf_url IS DISTINCT FROM OLD.factura_pdf_url
     OR NEW.timbrado_en IS DISTINCT FROM OLD.timbrado_en
    THEN
      RAISE EXCEPTION 'factura_inmutable: la identidad fiscal de la factura % no puede modificarse desde la aplicación.', OLD.numero
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.numero        IS DISTINCT FROM OLD.numero
   OR NEW.subtotal     IS DISTINCT FROM OLD.subtotal
   OR NEW.iva          IS DISTINCT FROM OLD.iva
   OR NEW.total        IS DISTINCT FROM OLD.total
   OR NEW.moneda       IS DISTINCT FROM OLD.moneda
   OR NEW.tipo_cambio  IS DISTINCT FROM OLD.tipo_cambio
   OR NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision
   OR NEW.cliente_id   IS DISTINCT FROM OLD.cliente_id
   OR NEW.embarque_id  IS DISTINCT FROM OLD.embarque_id
   OR NEW.proforma_id  IS DISTINCT FROM OLD.proforma_id
  THEN
    RAISE EXCEPTION 'factura_inmutable: la factura % ya fue emitida y no puede modificarse. Emite una nota de crédito.', OLD.numero
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;
