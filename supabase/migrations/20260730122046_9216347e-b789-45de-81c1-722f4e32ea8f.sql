DROP POLICY IF EXISTS "Miembros crean catalogo_claves_sat" ON public.catalogo_claves_sat;
CREATE POLICY "Miembros crean catalogo_claves_sat"
  ON public.catalogo_claves_sat FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );