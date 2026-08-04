CREATE OR REPLACE FUNCTION public._embarques_sembrar_tc_dof()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tc RECORD;
BEGIN
  IF (NEW.tipo_cambio_usd IS NULL OR NEW.tipo_cambio_usd <= 0)
     OR (NEW.tipo_cambio_eur IS NULL OR NEW.tipo_cambio_eur <= 0) THEN
    SELECT * INTO v_tc FROM public.tc_dof_vigente(CURRENT_DATE);
    IF v_tc.usd_mxn IS NOT NULL AND v_tc.usd_mxn > 0
       AND (NEW.tipo_cambio_usd IS NULL OR NEW.tipo_cambio_usd <= 0) THEN
      NEW.tipo_cambio_usd := v_tc.usd_mxn;
    END IF;
    IF v_tc.eur_mxn IS NOT NULL AND v_tc.eur_mxn > 0
       AND (NEW.tipo_cambio_eur IS NULL OR NEW.tipo_cambio_eur <= 0) THEN
      NEW.tipo_cambio_eur := v_tc.eur_mxn;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._embarques_sembrar_tc_dof() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._embarques_sembrar_tc_dof() FROM anon;
GRANT EXECUTE ON FUNCTION public._embarques_sembrar_tc_dof() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_embarques_sembrar_tc_dof ON public.embarques;
CREATE TRIGGER trg_embarques_sembrar_tc_dof
  BEFORE INSERT ON public.embarques
  FOR EACH ROW EXECUTE FUNCTION public._embarques_sembrar_tc_dof();