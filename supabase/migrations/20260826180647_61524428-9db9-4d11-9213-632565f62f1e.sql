CREATE OR REPLACE FUNCTION public.puede_escribir_cotizaciones(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'super_admin'::app_role)
    OR public.has_role(_user_id, 'admin_org'::app_role)
    OR public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'gerente_comercial'::app_role)
    OR public.has_role(_user_id, 'vendedor'::app_role)
    OR public.has_role(_user_id, 'ejecutivo_pricing'::app_role)
    -- v13.750.0: roles operativos habilitados para cotizar.
    OR public.has_role(_user_id, 'coordinador_logistico'::app_role)
    OR public.has_role(_user_id, 'gerente_operaciones'::app_role)
    OR public.has_role(_user_id, 'operador'::app_role)
    OR public.has_role(_user_id, 'customer_service'::app_role)
  )
$function$;

REVOKE ALL ON FUNCTION public.puede_escribir_cotizaciones(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_escribir_cotizaciones(uuid) TO authenticated, service_role;

-- conceptos_venta: incluir customer_service (los demás operativos ya entran por
-- el agrupador de 'operador' en has_role).
DROP POLICY IF EXISTS "Tenant write conceptos_venta" ON public.conceptos_venta;
CREATE POLICY "Tenant write conceptos_venta" ON public.conceptos_venta
FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.has_any_role_efectivo((SELECT auth.uid()), ARRAY['admin'::app_role,'admin_org'::app_role,'operador'::app_role,'contador'::app_role,'super_admin'::app_role,'customer_service'::app_role]))
);

DROP POLICY IF EXISTS "Tenant update conceptos_venta" ON public.conceptos_venta;
CREATE POLICY "Tenant update conceptos_venta" ON public.conceptos_venta
FOR UPDATE TO authenticated
USING (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.has_any_role_efectivo((SELECT auth.uid()), ARRAY['admin'::app_role,'admin_org'::app_role,'operador'::app_role,'contador'::app_role,'super_admin'::app_role,'customer_service'::app_role]))
)
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.has_any_role_efectivo((SELECT auth.uid()), ARRAY['admin'::app_role,'admin_org'::app_role,'operador'::app_role,'contador'::app_role,'super_admin'::app_role,'customer_service'::app_role]))
);