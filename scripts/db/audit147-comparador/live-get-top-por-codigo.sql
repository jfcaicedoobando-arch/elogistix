CREATE OR REPLACE FUNCTION public.get_top_tarifas_por_codigo(p_origen_code text, p_destino_code text, p_contenedor_code text, p_fecha date DEFAULT CURRENT_DATE, p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF costeo_tarifas_vigentes_v
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.get_top_tarifas(
    public.resolver_puerto_id(p_origen_code),
    public.resolver_puerto_id(p_destino_code),
    public.resolver_tipo_contenedor_id(p_contenedor_code),
    p_fecha,
    p_organization_id
  );
$function$
