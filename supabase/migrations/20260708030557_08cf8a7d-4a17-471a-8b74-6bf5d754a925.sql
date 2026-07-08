-- Bypass del candado de embarques cerrados para este backfill puntual
SET LOCAL app.bypass_cierre = 'on';

-- 1. Backfill eta_original / etd_original desde valores actuales cuando estén vacíos
UPDATE embarques
SET eta_original = eta
WHERE eta_original IS NULL AND eta IS NOT NULL;

UPDATE embarques
SET etd_original = etd
WHERE etd_original IS NULL AND etd IS NOT NULL;

-- 2. Trigger que congela eta_original / etd_original
CREATE OR REPLACE FUNCTION public.embarques_freeze_eta_original()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.eta_original := COALESCE(NEW.eta_original, NEW.eta);
    NEW.etd_original := COALESCE(NEW.etd_original, NEW.etd);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.eta_original IS NOT NULL THEN
      NEW.eta_original := OLD.eta_original;
    ELSE
      NEW.eta_original := COALESCE(NEW.eta_original, NEW.eta);
    END IF;
    IF OLD.etd_original IS NOT NULL THEN
      NEW.etd_original := OLD.etd_original;
    ELSE
      NEW.etd_original := COALESCE(NEW.etd_original, NEW.etd);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_embarques_freeze_eta_original ON public.embarques;
CREATE TRIGGER trg_embarques_freeze_eta_original
BEFORE INSERT OR UPDATE ON public.embarques
FOR EACH ROW EXECUTE FUNCTION public.embarques_freeze_eta_original();

-- 3. Nuevo valor del enum para eventos de tracking
ALTER TYPE public.tipo_evento_tracking ADD VALUE IF NOT EXISTS 'Cambio de ETA';