-- Fuente canónica de public.puede_aprobar_tarifa_cotizacion (v13.823.352).
-- Fuente vigente: 20260913220612_3b8c5b8d-a492-4dd4-ae81-1b4a161c482f.sql
--
-- Rol APROBADOR del flujo comercial: resolver una re-aprobación de tarifa y
-- versionar (re-cotizar) una cotización aceptada son decisiones de ventas y
-- administración, no de operación ni de finanzas.
--
-- Espejo EXACTO en la UI: `APROBAR_TARIFA_COTIZACION` de
-- `src/lib/access/permissionMatrix.cotizaciones.ts`. Al cambiar una lista hay
-- que cambiar la otra.
--
-- ANCLA TENANT (v13.823.352, linter ORG-SCOPE): además del rol aprobador
-- (`has_any_role_efectivo`, que ya resuelve el rol de la membresía activa),
-- la función exige que el usuario sea miembro de la organización activa
-- (`organization_members` + `current_user_org_id()`). `super_admin` queda
-- exento por diseño (su rol vive en `user_roles`) y un usuario sin ninguna
-- membresía conserva el criterio de rol global, igual que el resto de los
-- helpers de rol efectivo.

CREATE OR REPLACE FUNCTION public.puede_aprobar_tarifa_cotizacion(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL
     AND public.has_any_role_efectivo(
           _user_id,
           ARRAY['admin','vendedor','ejecutivo_pricing']::app_role[])
     AND (
       public.has_role(_user_id, 'super_admin'::app_role)
       OR NOT EXISTS (
            SELECT 1 FROM public.organization_members om
             WHERE om.user_id = _user_id
          )
       OR EXISTS (
            SELECT 1 FROM public.organization_members om
             WHERE om.user_id = _user_id
               AND om.organization_id = public.current_user_org_id()
          )
     )
$function$;

REVOKE ALL ON FUNCTION public.puede_aprobar_tarifa_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_aprobar_tarifa_cotizacion(uuid) TO authenticated, service_role;
