CREATE OR REPLACE FUNCTION public.puede_ver_costos_cotizacion(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND public.has_any_role_efectivo(
    _user_id,
    ARRAY['admin','admin_org','super_admin',
          'gerente_operaciones','gerente_comercial','gerente_visor',
          'coordinador_logistico',
          'contador','tesorero','auxiliar_contable','ejecutivo_cobranza',
          'vendedor','ejecutivo_pricing']::app_role[]
  );
$function$;

REVOKE ALL ON FUNCTION public.puede_ver_costos_cotizacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.puede_ver_costos_cotizacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion(uuid) TO service_role;