-- Fuente canónica de public.puede_ver_costos_cotizacion
-- v13.823.391 — El rol `coordinador_logistico` (Coordinador Logístico) opera los
-- embarques que nacen de la cotización, así que debe ver su desglose de costos.
-- Al no estar en la lista, la política `Tenant read cotizacion_costos` filtraba
-- TODAS las filas sin error y el candado de UI concluía "la cotización no tiene
-- costos cargados" (falso negativo) al crear el embarque.
-- Ver supabase/schema/README.md.

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
