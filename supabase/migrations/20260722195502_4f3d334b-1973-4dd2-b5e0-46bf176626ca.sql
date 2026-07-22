CREATE OR REPLACE FUNCTION public.tg_liberar_folio_proveedor_factura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_num      bigint;
  v_max_vivo bigint;
BEGIN
  -- Sólo cuando pasa a borrado (soft delete). Ignora restore o updates normales.
  IF NEW.deleted_at IS NULL OR OLD.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Extrae número: FP-000046 -> 46
  v_num := NULLIF(regexp_replace(COALESCE(NEW.folio_interno, ''), '\D', '', 'g'), '')::bigint;
  IF v_num IS NULL THEN
    RETURN NEW;
  END IF;

  -- MAX numérico de folios activos (no borrados) para esta org
  SELECT COALESCE(
           MAX(NULLIF(regexp_replace(folio_interno, '\D', '', 'g'), '')::bigint),
           0
         )
    INTO v_max_vivo
    FROM public.proveedor_facturas
   WHERE organization_id = NEW.organization_id
     AND deleted_at IS NULL;

  -- Sólo retrocede el contador si NO quedan folios activos con número mayor.
  -- Reusar sólo si borraste la última; cubre borrado en cadena de las últimas.
  UPDATE public.folio_secuencias
     SET ultimo_numero = v_max_vivo,
         updated_at    = now()
   WHERE organization_id = NEW.organization_id
     AND tipo            = 'factura_proveedor'
     AND ultimo_numero   > v_max_vivo;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liberar_folio_proveedor_factura ON public.proveedor_facturas;

CREATE TRIGGER trg_liberar_folio_proveedor_factura
AFTER UPDATE OF deleted_at ON public.proveedor_facturas
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION public.tg_liberar_folio_proveedor_factura();

COMMENT ON FUNCTION public.tg_liberar_folio_proveedor_factura() IS
  'v13.307.14: Al soft-delete de una factura de proveedor, si era la última (o últimas en cadena), retrocede folio_secuencias.ultimo_numero al MAX de folios vivos para que el próximo alta reutilice el folio.';