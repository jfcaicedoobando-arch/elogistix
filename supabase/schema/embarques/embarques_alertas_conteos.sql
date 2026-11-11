CREATE OR REPLACE FUNCTION public.embarques_alertas_conteos()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'demora', count(DISTINCT embarque_id) FILTER (WHERE tipo = 'demora'),
    'garantia', count(DISTINCT embarque_id) FILTER (WHERE tipo = 'garantia'),
    'cierre_operativo', count(DISTINCT embarque_id) FILTER (WHERE tipo = 'cierre_operativo'),
    'admin_pendiente', count(DISTINCT embarque_id) FILTER (WHERE tipo = 'admin_pendiente')
  )
  FROM public.embarques_alertas_ids();
$function$;
