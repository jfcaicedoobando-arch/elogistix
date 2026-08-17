-- VF-20 — El rol `vendedor` obtiene acceso de SÓLO LECTURA a proformas.
-- Las policies de escritura (write/update/delete) se conservan intactas y
-- siguen excluyendo al vendedor.

DROP POLICY IF EXISTS "Tenant read proformas" ON public.proformas;

CREATE POLICY "Tenant read proformas" ON public.proformas
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT public.has_any_role((SELECT auth.uid()), ARRAY['viewer','vendedor']::app_role[]))
  );