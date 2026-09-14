-- Fuente canónica de public.cotizacion_tiene_costos
-- v13.823.392 · Auditoría cotización→embarque #1: el candado de UI contaba
-- filas de `cotizacion_costos` con los permisos del usuario. Los roles que SÍ
-- pueden convertir (coordinador_logistico, operador) pero no ven importes de
-- costos recibían `count = 0` sin error, así que la pantalla concluía "la
-- cotización no tiene costos cargados" y bloqueaba un flujo que el servidor sí
-- autoriza.
--
-- Esta función responde ÚNICAMENTE verdadero/falso sobre la existencia de
-- renglones vivos, acotada a la organización activa del usuario. No expone
-- ningún importe, así que no amplía la visibilidad de costos.
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public.cotizacion_tiene_costos(p_cotizacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.cotizacion_costos cc
      JOIN public.cotizaciones c ON c.id = cc.cotizacion_id
     WHERE cc.cotizacion_id = p_cotizacion_id
       AND cc.deleted_at IS NULL
       AND c.organization_id = public.current_user_org_id()
  );
$$;

REVOKE ALL ON FUNCTION public.cotizacion_tiene_costos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cotizacion_tiene_costos(uuid) TO authenticated, service_role;
