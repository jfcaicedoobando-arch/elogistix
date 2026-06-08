-- Endurece RLS en tablas de notificaciones añadiendo filtro redundante por organization_id (defense in depth).

DROP POLICY IF EXISTS "Users read own notifications" ON public.notificaciones_internas;
CREATE POLICY "Users read own notifications" ON public.notificaciones_internas
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() AND organization_id = current_user_org_id());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notificaciones_internas;
CREATE POLICY "Users update own notifications" ON public.notificaciones_internas
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() AND organization_id = current_user_org_id())
  WITH CHECK (usuario_id = auth.uid() AND organization_id = current_user_org_id());

DROP POLICY IF EXISTS "Usuario lee sus notificaciones" ON public.crm_notificaciones;
CREATE POLICY "Usuario lee sus notificaciones" ON public.crm_notificaciones
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND organization_id = current_user_org_id());

DROP POLICY IF EXISTS "Usuario marca leida su notificacion" ON public.crm_notificaciones;
CREATE POLICY "Usuario marca leida su notificacion" ON public.crm_notificaciones
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND organization_id = current_user_org_id())
  WITH CHECK (user_id = auth.uid() AND organization_id = current_user_org_id());