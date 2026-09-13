-- ORG-SCOPE: puede_aprobar_tarifa_cotizacion gana ancla tenant explícita.
-- Antes autorizaba sólo por rol global (user_roles) y el linter de ancla
-- tenant la marcaba como SECURITY DEFINER ejecutable por authenticated sin
-- referencia a organización. Ahora, además del rol aprobador comercial,
-- exige membresía en la organización activa (`organization_members` +
-- `current_user_org_id()`); `super_admin` queda exento por diseño y los
-- usuarios sin ninguna membresía conservan el criterio de
-- `has_any_role_efectivo` (rol global) para no romper contratos existentes.
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