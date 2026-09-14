-- v13.823.385 · Candado RESTRICTIVE de tenant activo (Ola 16) en
-- public.comisiones_recuperaciones. Forward-only. No toca datos de negocio.
--
-- Las RESTRICTIVE no otorgan nada: sólo acotan lo que ya permiten las
-- permisivas. Efecto: un super_admin queda limitado a la organización que
-- tiene activa en super_admin_org_activa.
--
-- Las mutaciones siguen exclusivamente en las RPC SECURITY DEFINER auditadas
-- (generar_liquidacion_comision / cancelar_liquidacion_comision): a
-- `authenticated` sólo se le concede SELECT.

DROP POLICY IF EXISTS "Scope tenant activo super admin" ON public.comisiones_recuperaciones;
CREATE POLICY "Scope tenant activo super admin"
ON public.comisiones_recuperaciones
AS RESTRICTIVE
FOR ALL
USING ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))) OR public.rls_tenant_scope_ok(organization_id))
WITH CHECK ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))) OR public.rls_tenant_scope_ok(organization_id));

-- ACL exacta: lectura in-org por policy permisiva; nada de escritura directa.
REVOKE ALL ON TABLE public.comisiones_recuperaciones FROM PUBLIC;
REVOKE ALL ON TABLE public.comisiones_recuperaciones FROM anon;
REVOKE ALL ON TABLE public.comisiones_recuperaciones FROM authenticated;
GRANT SELECT ON TABLE public.comisiones_recuperaciones TO authenticated;
GRANT ALL ON TABLE public.comisiones_recuperaciones TO service_role;
