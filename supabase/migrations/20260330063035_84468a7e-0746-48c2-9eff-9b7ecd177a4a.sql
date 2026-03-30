
DROP POLICY "Tenant admin bitacora" ON bitacora_actividad;
CREATE POLICY "Tenant admin bitacora" ON bitacora_actividad
  FOR SELECT TO authenticated
  USING (
    (organization_id = current_user_org_id() AND is_org_admin(auth.uid(), organization_id))
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
  );
