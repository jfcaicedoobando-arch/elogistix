-- Fuente canónica de public.puede_aprobar_tarifa_cotizacion (v13.823.354).
-- Fuente vigente: 20260913221146_641a2207-0c71-4f15-a55b-9af7e7923316.sql
--
-- Rol APROBADOR del flujo comercial: resolver una re-aprobación de tarifa y
-- versionar (re-cotizar) una cotización aceptada son decisiones de ventas y
-- administración, no de operación ni de finanzas.
--
-- Espejo EXACTO en la UI: `APROBAR_TARIFA_COTIZACION` de
-- `src/lib/access/permissionMatrix.cotizaciones.ts`. Al cambiar una lista hay
-- que cambiar la otra.
--
-- ANCLA TENANT (v13.823.354, linter ORG-SCOPE): el helper es tenant-aware por
-- parámetro. `_org` (DEFAULT `current_user_org_id()`) se valida con
-- `has_any_role_in_org`, que exige membresía con el rol aprobador en ESA
-- organización y ya exenta a `super_admin`. Un usuario sin ninguna membresía
-- conserva el criterio de rol global (`has_any_role_efectivo`), igual que el
-- resto de los helpers de rol efectivo. Los llamadores
-- (`resolver_reaprobacion_tarifa`, `recotizar_cotizacion`) pasan la
-- organización de la cotización, no la organización activa de la sesión.

DROP FUNCTION IF EXISTS public.puede_aprobar_tarifa_cotizacion(uuid);

CREATE OR REPLACE FUNCTION public.puede_aprobar_tarifa_cotizacion(
  _user_id uuid DEFAULT auth.uid(),
  _org uuid DEFAULT public.current_user_org_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL
     AND (
       public.has_any_role_in_org(
         _user_id,
         ARRAY['admin','vendedor','ejecutivo_pricing']::app_role[],
         _org)
       OR (
         NOT EXISTS (
           SELECT 1 FROM public.organization_members om WHERE om.user_id = _user_id
         )
         AND public.has_any_role_efectivo(
               _user_id,
               ARRAY['admin','vendedor','ejecutivo_pricing']::app_role[])
       )
     )
$function$;

REVOKE ALL ON FUNCTION public.puede_aprobar_tarifa_cotizacion(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_aprobar_tarifa_cotizacion(uuid, uuid) TO authenticated, service_role;
