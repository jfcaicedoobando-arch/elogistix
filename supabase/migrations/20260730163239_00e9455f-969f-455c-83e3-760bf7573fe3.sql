CREATE OR REPLACE FUNCTION public._cotizaciones_bloquear_envio_sin_importes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_usd numeric := 0;
  v_total_mxn numeric := 0;
BEGIN
  IF NEW.estado = 'Enviada'::estado_cotizacion
     AND COALESCE(OLD.estado, 'Borrador'::estado_cotizacion) <> 'Enviada'::estado_cotizacion
  THEN
    SELECT t.total_usd, t.total_mxn
      INTO v_total_usd, v_total_mxn
      FROM public.cotizacion_totales_conceptos(NEW.conceptos_venta) t;

    IF COALESCE(v_total_usd, 0) <= 0 AND COALESCE(v_total_mxn, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_COTIZACION_SIN_IMPORTES: la cotización no tiene importes de venta capturados'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._cotizaciones_bloquear_envio_sin_importes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._cotizaciones_bloquear_envio_sin_importes() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_cotizaciones_bloquear_envio_sin_importes ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_bloquear_envio_sin_importes
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public._cotizaciones_bloquear_envio_sin_importes();