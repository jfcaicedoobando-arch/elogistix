-- Fuente canónica de public.puede_aprobar_tarifa_cotizacion (v13.823.351).
--
-- Rol APROBADOR del flujo comercial: resolver una re-aprobación de tarifa y
-- versionar (re-cotizar) una cotización aceptada son decisiones de ventas y
-- administración, no de operación ni de finanzas.
--
-- Espejo EXACTO en la UI: `APROBAR_TARIFA_COTIZACION` de
-- `src/lib/access/permissionMatrix.cotizaciones.ts`. Al cambiar una lista hay
-- que cambiar la otra.
--
-- La jerarquía la resuelve `has_role` vía `roles_jerarquia`: `admin` cubre
-- admin_org y super_admin; `vendedor` cubre gerente_comercial, admin_org y
-- super_admin.

CREATE OR REPLACE FUNCTION public.puede_aprobar_tarifa_cotizacion(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'vendedor'::app_role)
    OR public.has_role(_user_id, 'ejecutivo_pricing'::app_role)
  )
$function$;

REVOKE ALL ON FUNCTION public.puede_aprobar_tarifa_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_aprobar_tarifa_cotizacion(uuid) TO authenticated, service_role;
