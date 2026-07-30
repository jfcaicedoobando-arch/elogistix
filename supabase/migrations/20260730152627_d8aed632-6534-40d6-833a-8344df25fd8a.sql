-- R-10: permitir alta/edición de navieras a roles operativos y administrativos.
GRANT SELECT, INSERT, UPDATE ON public.navieras TO authenticated;
GRANT ALL ON public.navieras TO service_role;

DROP POLICY IF EXISTS "Operativos y admin gestionan navieras" ON public.navieras;
CREATE POLICY "Operativos y admin gestionan navieras"
  ON public.navieras
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'admin_org'::app_role)
    OR public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role)
    OR public.has_role((SELECT auth.uid()), 'coordinador_logistico'::app_role)
  );

DROP POLICY IF EXISTS "Operativos y admin actualizan navieras" ON public.navieras;
CREATE POLICY "Operativos y admin actualizan navieras"
  ON public.navieras
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'admin_org'::app_role)
    OR public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role)
    OR public.has_role((SELECT auth.uid()), 'coordinador_logistico'::app_role)
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'admin_org'::app_role)
    OR public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role)
    OR public.has_role((SELECT auth.uid()), 'coordinador_logistico'::app_role)
  );