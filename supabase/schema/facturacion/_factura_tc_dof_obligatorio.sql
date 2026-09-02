-- Fuente canónica de public._factura_tc_dof_obligatorio() (Ola 9 · M2).
-- Toda factura en moneda extranjera nace con el T/C DOF de su fecha de emisión;
-- si no hay T/C disponible se bloquea la creación (LC_FACTURA_SIN_TC_DOF).
-- Defecto 2 (ronda posterior a v13.823.39): además el T/C vigente sólo puede
-- arrastrarse por días inhábiles (fin de semana / puentes). Fuera de esa
-- ventana se exige sincronizar el DOF (LC_FACTURA_TC_DOF_OBSOLETO).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public._factura_tc_dof_obligatorio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tc numeric;
  v_fecha date;
  v_fecha_dof date;
  v_rezago int;
  -- Tolerancia de días hábiles sin publicación (puentes oficiales, Semana
  -- Santa). Más allá de esto el dato está obsoleto, no "pendiente".
  c_max_rezago_habil constant int := 2;
BEGIN
  -- Timbradas: inmutables por los guards fiscales existentes; no recalculamos.
  IF TG_OP = 'UPDATE' AND OLD.uuid_fiscal IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.moneda::text = 'MXN' THEN
    NEW.tipo_cambio := 1;
    RETURN NEW;
  END IF;

  -- El T/C NUNCA se toma de lo capturado: se resuelve del DOF vigente a la
  -- fecha de emisión, así que un valor arbitrario u obsoleto no persiste.
  v_fecha := COALESCE(NEW.fecha_emision, (now() AT TIME ZONE 'America/Mexico_City')::date);

  SELECT d.fecha,
         CASE
           WHEN NEW.moneda::text = 'USD' THEN d.usd_mxn
           WHEN NEW.moneda::text = 'EUR' THEN d.eur_mxn
         END
    INTO v_fecha_dof, v_tc
  FROM public.tc_dof_vigente(v_fecha) d;

  IF COALESCE(v_tc, 0) <= 1 THEN
    RAISE EXCEPTION 'LC_FACTURA_SIN_TC_DOF: no hay tipo de cambio DOF para % al %; captúralo antes de generar la factura',
      NEW.moneda, v_fecha
      USING ERRCODE = '22023';
  END IF;

  -- Defecto 2: el arrastre sólo se permite por días inhábiles.
  v_rezago := public.dof_dias_habiles_entre(v_fecha_dof, v_fecha);
  IF v_rezago > c_max_rezago_habil THEN
    RAISE EXCEPTION 'LC_FACTURA_TC_DOF_OBSOLETO: el tipo de cambio DOF más reciente es del % (% días hábiles antes del %); sincroniza el DOF o captúralo antes de facturar',
      v_fecha_dof, v_rezago, v_fecha
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
BEFORE UPDATE OF moneda, fecha_emision, tipo_cambio ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public._factura_tc_dof_obligatorio();
