CREATE OR REPLACE FUNCTION public.assert_nc_fecha_valida()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha_factura date;
  -- Techo tolerante: entre 18:00 y 24:00 hora de México el servidor (UTC) ya
  -- está en el día siguiente. Usar sólo la fecha de México rechazaba NC
  -- capturadas por la tarde. Tomamos la mayor de ambas fechas.
  v_hoy_max date := GREATEST((now() AT TIME ZONE 'America/Mexico_City')::date, CURRENT_DATE);
BEGIN
  SELECT f.fecha_emision INTO v_fecha_factura
  FROM public.facturas f
  WHERE f.id = NEW.factura_id;

  IF v_fecha_factura IS NULL OR NEW.fecha_emision IS NULL
     OR NEW.fecha_emision < v_fecha_factura OR NEW.fecha_emision > v_hoy_max THEN
    RAISE EXCEPTION 'LC_NC_FECHA_INVALIDA: la fecha debe estar entre la emisión de la factura y hoy'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.assert_nc_fecha_valida() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_nc_fecha_valida() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_nc_fecha_valida ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_fecha_valida
BEFORE INSERT OR UPDATE OF factura_id, fecha_emision ON public.factura_notas_credito
FOR EACH ROW EXECUTE FUNCTION public.assert_nc_fecha_valida();