-- Fuente canónica de public._factura_tc_dof_obligatorio() (Ola 9 · M2).
-- Toda factura en moneda extranjera nace con el T/C DOF de su fecha de emisión;
-- si no hay T/C disponible se bloquea la creación (LC_FACTURA_SIN_TC_DOF).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public._factura_tc_dof_obligatorio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_tc numeric;
  v_fecha date;
BEGIN
  IF NEW.moneda::text = 'MXN' THEN
    -- M2-res: al volver a MXN el T/C heredado deja de aplicar.
    IF TG_OP = 'UPDATE' AND OLD.moneda::text <> 'MXN' THEN
      NEW.tipo_cambio := 1;
    END IF;
    RETURN NEW;
  END IF;

  -- M2-res: si la moneda cambió, el T/C anterior no sirve: se recalcula.
  IF TG_OP = 'UPDATE'
     AND OLD.moneda::text IS DISTINCT FROM NEW.moneda::text
     AND NEW.tipo_cambio IS NOT DISTINCT FROM OLD.tipo_cambio THEN
    NEW.tipo_cambio := NULL;
  END IF;

  IF COALESCE(NEW.tipo_cambio, 0) > 1 THEN
    RETURN NEW;
  END IF;

  v_fecha := COALESCE(NEW.fecha_emision, (now() AT TIME ZONE 'America/Mexico_City')::date);

  SELECT CASE
           WHEN NEW.moneda::text = 'USD' THEN d.usd_mxn
           WHEN NEW.moneda::text = 'EUR' THEN d.eur_mxn
         END
    INTO v_tc
  FROM public.tc_dof_vigente(v_fecha) d;

  IF COALESCE(v_tc, 0) <= 1 THEN
    RAISE EXCEPTION 'LC_FACTURA_SIN_TC_DOF: no hay tipo de cambio DOF para % al %; captúralo antes de generar la factura',
      NEW.moneda, v_fecha
      USING ERRCODE = '22023';
  END IF;

  NEW.tipo_cambio := v_tc;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_factura_tc_dof_obligatorio ON public.facturas;
CREATE TRIGGER trg_factura_tc_dof_obligatorio
BEFORE INSERT ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public._factura_tc_dof_obligatorio();

DROP TRIGGER IF EXISTS trg_factura_tc_dof_obligatorio_upd ON public.facturas;
CREATE TRIGGER trg_factura_tc_dof_obligatorio_upd
BEFORE UPDATE OF moneda ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public._factura_tc_dof_obligatorio();
