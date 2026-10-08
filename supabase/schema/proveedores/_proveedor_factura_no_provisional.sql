CREATE OR REPLACE FUNCTION public._proveedor_factura_no_provisional() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.proveedor_id IS NOT NULL AND EXISTS (SELECT 1 FROM proveedores WHERE id = NEW.proveedor_id AND estado_alta = 'provisional') THEN
    RAISE EXCEPTION 'Este proveedor está pendiente de aprobación por Contabilidad' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._proveedor_factura_no_provisional() FROM PUBLIC, anon, authenticated RESTRICT;
