-- Sentry 3S/3T: los administradores de organización (admin_org) no podían
-- crear/editar cuentas bancarias de su propio tenant. Se amplía la política de
-- escritura a admin_org (siempre acotada a su organización). tesorero/contador
-- permanecen sólo lectura.
DROP POLICY IF EXISTS "Tenant CRUD cuentas_bancarias" ON public.cuentas_bancarias;

CREATE POLICY "Tenant CRUD cuentas_bancarias"
ON public.cuentas_bancarias
FOR ALL
TO authenticated
USING (
  ((organization_id = (SELECT public.current_user_org_id()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'admin_org'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'admin_org'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  )
);

-- Sentry 3Q (PGRST200): el caché de esquema de la API quedó viejo tras una
-- migración y no encontraba la relación facturas -> proformas.
NOTIFY pgrst, 'reload schema';