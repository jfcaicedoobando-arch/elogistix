DROP POLICY IF EXISTS crm_propiedades_leer ON public.crm_propiedades;
CREATE POLICY crm_propiedades_leer ON public.crm_propiedades FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid())
);
DROP POLICY IF EXISTS crm_propiedad_opciones_leer ON public.crm_propiedad_opciones;
CREATE POLICY crm_propiedad_opciones_leer ON public.crm_propiedad_opciones FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid())
);