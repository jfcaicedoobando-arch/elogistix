-- Reabrir documentos del buzón cuando la factura se cancela o se elimina
CREATE OR REPLACE FUNCTION public._reabrir_entrantes_factura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.embarque_facturas_entrantes e
     SET estado = 'por_capturar',
         proveedor_factura_id = NULL,
         capturado_por = NULL
   WHERE e.proveedor_factura_id = NEW.id
     AND e.deleted_at IS NULL
     AND e.estado = 'capturada';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._reabrir_entrantes_factura() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._reabrir_entrantes_factura() TO service_role;
GRANT EXECUTE ON FUNCTION public._reabrir_entrantes_factura() TO postgres;

DROP TRIGGER IF EXISTS trg_reabrir_entrantes_factura ON public.proveedor_facturas;
CREATE TRIGGER trg_reabrir_entrantes_factura
AFTER UPDATE ON public.proveedor_facturas
FOR EACH ROW
WHEN (
  ((NEW.estado IS DISTINCT FROM OLD.estado) AND NEW.estado = 'Cancelada'::estado_proveedor_factura)
  OR ((NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) AND NEW.deleted_at IS NOT NULL)
)
EXECUTE FUNCTION public._reabrir_entrantes_factura();

-- El cierre automático no debe aplicar a facturas canceladas
CREATE OR REPLACE FUNCTION public._cerrar_entrantes_por_uuid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.uuid_fiscal IS NULL
     OR NEW.deleted_at IS NOT NULL
     OR NEW.estado = 'Cancelada'::estado_proveedor_factura THEN
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
GRANT EXECUTE ON FUNCTION public._cerrar_entrantes_por_uuid() TO service_role;
GRANT EXECUTE ON FUNCTION public._cerrar_entrantes_por_uuid() TO postgres;

-- Backfill: documentos cerrados contra facturas canceladas o eliminadas
UPDATE public.embarque_facturas_entrantes e
   SET estado = 'por_capturar',
       proveedor_factura_id = NULL,
       capturado_por = NULL
  FROM public.proveedor_facturas pf
 WHERE e.proveedor_factura_id = pf.id
   AND e.deleted_at IS NULL
   AND e.estado = 'capturada'
   AND (pf.deleted_at IS NOT NULL OR pf.estado = 'Cancelada'::estado_proveedor_factura);