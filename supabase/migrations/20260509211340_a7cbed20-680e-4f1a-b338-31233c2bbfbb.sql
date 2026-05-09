ALTER TABLE public.embarques
  ADD COLUMN IF NOT EXISTS etd_original date,
  ADD COLUMN IF NOT EXISTS eta_original date;

UPDATE public.embarques
SET etd_original = COALESCE(etd_original, etd),
    eta_original = COALESCE(eta_original, eta)
WHERE etd_original IS NULL OR eta_original IS NULL;

CREATE OR REPLACE FUNCTION public.set_embarque_fechas_originales()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.etd_original IS NULL THEN NEW.etd_original := NEW.etd; END IF;
  IF NEW.eta_original IS NULL THEN NEW.eta_original := NEW.eta; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS embarques_set_fechas_originales ON public.embarques;
CREATE TRIGGER embarques_set_fechas_originales
BEFORE INSERT ON public.embarques
FOR EACH ROW EXECUTE FUNCTION public.set_embarque_fechas_originales();