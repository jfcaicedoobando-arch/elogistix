CREATE POLICY "Gerente operaciones y admins dan de alta navieras" ON public.navieras FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role)));
CREATE POLICY "Gerente operaciones y admins dan de alta puertos" ON public.puertos FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role)));
CREATE POLICY "Gerente operaciones y admins dan de alta tipos_contenedor" ON public.tipos_contenedor FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role)));