-- Cierre automático de documentos del buzón CxP cuyo CFDI ya fue capturado
CREATE OR REPLACE FUNCTION public._cerrar_entrantes_por_uuid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.uuid_fiscal IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.embarque_facturas_entrantes e
     SET estado = 'capturada',
         proveedor_factura_id = NEW.id,
         capturado_por = COALESCE(auth.uid(), NEW.created_by, e.capturado_por)
   WHERE e.estado = 'por_capturar'
     AND e.deleted_at IS NULL
     AND e.organization_id = NEW.organization_id
     AND e.uuid_fiscal IS NOT NULL
     AND upper(btrim(e.uuid_fiscal)) = upper(btrim(NEW.uuid_fiscal));

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._cerrar_entrantes_por_uuid() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_cerrar_entrantes_por_uuid ON public.proveedor_facturas;
CREATE TRIGGER trg_cerrar_entrantes_por_uuid
AFTER INSERT OR UPDATE OF uuid_fiscal, deleted_at ON public.proveedor_facturas
FOR EACH ROW EXECUTE FUNCTION public._cerrar_entrantes_por_uuid();

-- Backfill idempotente de los documentos que quedaron colgados
UPDATE public.embarque_facturas_entrantes e
   SET estado = 'capturada',
       proveedor_factura_id = pf.id,
       capturado_por = COALESCE(e.capturado_por, pf.created_by)
  FROM public.proveedor_facturas pf
 WHERE e.estado = 'por_capturar'
   AND e.deleted_at IS NULL
   AND e.uuid_fiscal IS NOT NULL
   AND pf.deleted_at IS NULL
   AND pf.organization_id = e.organization_id
   AND upper(btrim(pf.uuid_fiscal)) = upper(btrim(e.uuid_fiscal));
GRANT EXECUTE ON FUNCTION public._cerrar_entrantes_por_uuid() TO service_role;
GRANT EXECUTE ON FUNCTION public._cerrar_entrantes_por_uuid() TO postgres;
