-- Ola 16: candado RESTRICTIVE de tenant activo para comisiones_recuperaciones.
-- Sin esta política, un super_admin veía filas de TODAS las organizaciones.
-- No otorga permisos: las RESTRICTIVE sólo acotan lo ya permitido por las
-- políticas permisivas (aquí, únicamente el SELECT por organización).
DROP POLICY IF EXISTS "Scope tenant activo super admin" ON public.comisiones_recuperaciones;
CREATE POLICY "Scope tenant activo super admin"
ON public.comisiones_recuperaciones
AS RESTRICTIVE
FOR ALL
USING ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))) OR public.rls_tenant_scope_ok(organization_id))
WITH CHECK ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))) OR public.rls_tenant_scope_ok(organization_id));