-- Backfill: rellena codigo_postal desde cp cuando esté vacío
UPDATE public.clientes
SET codigo_postal = cp
WHERE (codigo_postal IS NULL OR codigo_postal = '')
  AND cp IS NOT NULL AND cp <> '';

-- Y viceversa por si algún cliente tuviera solo codigo_postal
UPDATE public.clientes
SET cp = codigo_postal
WHERE (cp IS NULL OR cp = '')
  AND codigo_postal IS NOT NULL AND codigo_postal <> '';

-- Trigger para mantener ambas columnas sincronizadas
CREATE OR REPLACE FUNCTION public.clientes_sync_cp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.cp IS NULL OR NEW.cp = '') AND NEW.codigo_postal IS NOT NULL AND NEW.codigo_postal <> '' THEN
      NEW.cp := NEW.codigo_postal;
    ELSIF (NEW.codigo_postal IS NULL OR NEW.codigo_postal = '') AND NEW.cp IS NOT NULL AND NEW.cp <> '' THEN
      NEW.codigo_postal := NEW.cp;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si cambió cp, propaga a codigo_postal
    IF NEW.cp IS DISTINCT FROM OLD.cp AND NEW.cp IS NOT NULL AND NEW.cp <> '' THEN
      NEW.codigo_postal := NEW.cp;
    -- Si cambió codigo_postal y cp quedó vacío o igual al anterior, propaga a cp
    ELSIF NEW.codigo_postal IS DISTINCT FROM OLD.codigo_postal
          AND NEW.codigo_postal IS NOT NULL AND NEW.codigo_postal <> '' THEN
      NEW.cp := NEW.codigo_postal;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_sync_cp ON public.clientes;
CREATE TRIGGER trg_clientes_sync_cp
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.clientes_sync_cp();