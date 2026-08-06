-- Permitir que administradores y operativos activen/desactiven y agreguen puertos
-- (mismo criterio que ya existe para navieras). El borrado sigue restringido a super_admin.
CREATE POLICY "Operativos y admin actualizan puertos"
ON public.puertos FOR UPDATE TO authenticated
USING (
  (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'coordinador_logistico'::app_role))
)
WITH CHECK (
  (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'coordinador_logistico'::app_role))
);

CREATE POLICY "Operativos y admin agregan puertos"
ON public.puertos FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'coordinador_logistico'::app_role))
);