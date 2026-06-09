
CREATE OR REPLACE FUNCTION public.embarques_protect_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Si el operador anterior ya tenía valor (no vacío), no permitir cambio.
  IF OLD.operador IS NOT NULL AND length(trim(OLD.operador)) > 0 THEN
    NEW.operador := OLD.operador;
  END IF;
  -- Mismo principio con el correo del creador.
  IF OLD.created_by_email IS NOT NULL AND length(trim(OLD.created_by_email)) > 0 THEN
    NEW.created_by_email := OLD.created_by_email;
  END IF;
  -- Y con el uuid del creador.
  IF OLD.created_by IS NOT NULL THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_embarques_protect_creator ON public.embarques;
CREATE TRIGGER trg_embarques_protect_creator
BEFORE UPDATE ON public.embarques
FOR EACH ROW
EXECUTE FUNCTION public.embarques_protect_creator();
