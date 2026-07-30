-- Sentry JAVASCRIPT-REACT-3S: los roles comerciales (ejecutivo_pricing,
-- vendedor, operativo…) crean conceptos SAT en línea desde el wizard de
-- cotización, pero la política CRUD sólo permitía admin/admin_org/contador.
-- Añadimos INSERT para cualquier miembro de la organización; UPDATE/DELETE
-- siguen restringidos a los roles administrativos.

DROP POLICY IF EXISTS "Miembros crean catalogo_claves_sat" ON public.catalogo_claves_sat;
CREATE POLICY "Miembros crean catalogo_claves_sat"
  ON public.catalogo_claves_sat FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
