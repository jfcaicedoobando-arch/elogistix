
CREATE OR REPLACE FUNCTION public.facturas_set_fecha_vencimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fecha_emision IS NOT NULL THEN
    NEW.fecha_vencimiento := NEW.fecha_emision + COALESCE(NEW.dias_credito, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facturas_set_fecha_vencimiento ON public.facturas;

CREATE TRIGGER trg_facturas_set_fecha_vencimiento
BEFORE INSERT OR UPDATE OF fecha_emision, dias_credito
ON public.facturas
FOR EACH ROW
EXECUTE FUNCTION public.facturas_set_fecha_vencimiento();

-- Backfill: corrige facturas cuyo vencimiento no coincide con fecha_emision + dias_credito.
UPDATE public.facturas
SET fecha_vencimiento = fecha_emision + COALESCE(dias_credito, 0)
WHERE fecha_emision IS NOT NULL
  AND fecha_vencimiento IS DISTINCT FROM (fecha_emision + COALESCE(dias_credito, 0));
