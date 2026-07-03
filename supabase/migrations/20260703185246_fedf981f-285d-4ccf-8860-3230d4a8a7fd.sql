-- 13.162.0 — Formalizar policies de tracking_externo (antes creadas manualmente
-- en prod y sólo replicadas en supabase/tests/rls/_ci_post_migrate.sql).
-- Idempotente: drop-if-exists antes de crear.

DROP POLICY IF EXISTS "Tenant CRUD tracking_externo" ON public.tracking_externo;
DROP POLICY IF EXISTS "Tenant viewer tracking_externo" ON public.tracking_externo;
DROP POLICY IF EXISTS "Cliente read own tracking_externo" ON public.tracking_externo;

CREATE POLICY "Tenant CRUD tracking_externo" ON public.tracking_externo
  FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id())
      OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id())
      OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE POLICY "Tenant viewer tracking_externo" ON public.tracking_externo
  FOR SELECT TO authenticated
  USING (
    ((organization_id = current_user_org_id())
      OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_role(auth.uid(), 'viewer'::app_role)
  );

CREATE POLICY "Cliente read own tracking_externo" ON public.tracking_externo
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND embarque_id IN (
      SELECT id FROM public.embarques
      WHERE cliente_id IN (SELECT current_user_client_ids())
    )
  );