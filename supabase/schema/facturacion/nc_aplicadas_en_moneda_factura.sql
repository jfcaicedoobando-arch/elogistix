-- Fuente canonica de public.nc_aplicadas_en_moneda_factura(uuid).
-- Envoltura de la autoridad interna; misma conversion y estados de NC.
-- Replay reparado por 20261012010000_nc_publica_paridad_replay.sql.
-- Sin formula duplicada: Timbrada/Aplicada y deleted_at siguen al helper interno.
-- Para aplicar, usar el forward con precondiciones de catalogo/ACL y transaccion.

CREATE OR REPLACE FUNCTION public.nc_aplicadas_en_moneda_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public._nc_aplicadas_moneda_factura(p_factura_id);
$function$;

REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) TO service_role;
