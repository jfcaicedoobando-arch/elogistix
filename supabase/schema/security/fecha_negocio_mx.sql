-- Fuente canónica de public.fecha_negocio_mx().
--
-- M3 (v13.823.384): canon ÚNICO de "hoy" para los RPCs financieros. Varias
-- funciones usaban `GREATEST((now() AT TIME ZONE 'America/Mexico_City')::date,
-- CURRENT_DATE)` o `CURRENT_DATE` directo: entre 18:00 y 23:59 de México el día
-- UTC ya avanzó, así que se podía registrar un movimiento con fecha de MAÑANA
-- en México. La fecha de negocio es SIEMPRE el día en America/Mexico_City.
--
-- No sustituye a los límites de emisión ni de corte bancario: sólo define el
-- tope superior "no futuro".

CREATE OR REPLACE FUNCTION public.fecha_negocio_mx()
RETURNS date
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT (now() AT TIME ZONE 'America/Mexico_City')::date;
$function$;

REVOKE ALL ON FUNCTION public.fecha_negocio_mx() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fecha_negocio_mx() TO authenticated, service_role;
