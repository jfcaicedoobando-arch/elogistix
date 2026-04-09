
DROP POLICY IF EXISTS "Org staff manage tracking_links" ON public.tracking_links;

CREATE POLICY "Org staff manage tracking_links" ON public.tracking_links
FOR ALL TO authenticated
USING (
  (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR is_org_admin(auth.uid(), organization_id)
  )
)
WITH CHECK (
  (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR is_org_admin(auth.uid(), organization_id)
  )
);
