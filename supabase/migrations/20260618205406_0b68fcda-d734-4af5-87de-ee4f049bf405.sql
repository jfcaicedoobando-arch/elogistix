
-- 1) app_logs: tenant-scope on INSERT
DROP POLICY IF EXISTS "app_logs insert authenticated" ON public.app_logs;
CREATE POLICY "app_logs insert authenticated" ON public.app_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND (organization_id IS NULL OR organization_id = public.current_user_org_id())
  );

-- 2) auditoria_snapshots: role-gated WITH CHECK
DROP POLICY IF EXISTS "Tenant write auditoria_snapshots" ON public.auditoria_snapshots;
CREATE POLICY "Tenant write auditoria_snapshots" ON public.auditoria_snapshots
  FOR ALL TO authenticated
  USING (
    (organization_id = public.current_user_org_id()
      AND (public.has_org_role(auth.uid(), organization_id, 'admin'::public.app_role)
           OR public.has_org_role(auth.uid(), organization_id, 'operador'::public.app_role)))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    (organization_id = public.current_user_org_id()
      AND (public.has_org_role(auth.uid(), organization_id, 'admin'::public.app_role)
           OR public.has_org_role(auth.uid(), organization_id, 'operador'::public.app_role)))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- 3) costeo_* tables: role-gated write
DROP POLICY IF EXISTS costeo_agentes_write_org ON public.costeo_agentes;
CREATE POLICY costeo_agentes_write_org ON public.costeo_agentes
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = costeo_agentes.organization_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador'))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = costeo_agentes.organization_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador'))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS costeo_tarifas_write_org ON public.costeo_tarifas;
CREATE POLICY costeo_tarifas_write_org ON public.costeo_tarifas
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = costeo_tarifas.organization_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador'))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = costeo_tarifas.organization_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador'))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS costeo_rutas_write_org ON public.costeo_rutas;
CREATE POLICY costeo_rutas_write_org ON public.costeo_rutas
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = costeo_rutas.organization_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador'))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = costeo_rutas.organization_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador'))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS costeo_nav_cond_write_org ON public.costeo_navieras_condiciones;
CREATE POLICY costeo_nav_cond_write_org ON public.costeo_navieras_condiciones
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = costeo_navieras_condiciones.organization_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador'))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = costeo_navieras_condiciones.organization_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador'))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS costeo_recargos_write_org ON public.costeo_tarifa_recargos;
CREATE POLICY costeo_recargos_write_org ON public.costeo_tarifa_recargos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.costeo_tarifas t
      JOIN public.organization_members m ON m.organization_id = t.organization_id
      WHERE t.id = costeo_tarifa_recargos.tarifa_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador')
    )
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.costeo_tarifas t
      JOIN public.organization_members m ON m.organization_id = t.organization_id
      WHERE t.id = costeo_tarifa_recargos.tarifa_id
        AND m.user_id = auth.uid()
        AND m.role::text IN ('admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador')
    )
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Tenant CRUD demoras venta" ON public.costeo_demoras_venta_tarifa;
CREATE POLICY "Tenant CRUD demoras venta" ON public.costeo_demoras_venta_tarifa
  FOR ALL TO authenticated
  USING (
    (organization_id = public.current_user_org_id()
      AND (public.has_role(auth.uid(), 'admin'::public.app_role)
           OR public.has_role(auth.uid(), 'admin_org'::public.app_role)
           OR public.has_role(auth.uid(), 'gerente_operaciones'::public.app_role)
           OR public.has_role(auth.uid(), 'ejecutivo_pricing'::public.app_role)
           OR public.has_role(auth.uid(), 'operador'::public.app_role)))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    (organization_id = public.current_user_org_id()
      AND (public.has_role(auth.uid(), 'admin'::public.app_role)
           OR public.has_role(auth.uid(), 'admin_org'::public.app_role)
           OR public.has_role(auth.uid(), 'gerente_operaciones'::public.app_role)
           OR public.has_role(auth.uid(), 'ejecutivo_pricing'::public.app_role)
           OR public.has_role(auth.uid(), 'operador'::public.app_role)))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- 4) cierre_embarque_log: restrict INSERT to org members
DROP POLICY IF EXISTS "Insertar log de cierre" ON public.cierre_embarque_log;
CREATE POLICY "Insertar log de cierre" ON public.cierre_embarque_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = cierre_embarque_log.organization_id
    )
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- 5) seguros_embarque: soft-delete policy must be RESTRICTIVE, not permissive
DROP POLICY IF EXISTS "Hide soft deleted seguros" ON public.seguros_embarque;
CREATE POLICY "Hide soft deleted seguros" ON public.seguros_embarque
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (true);

-- 6) View: enforce security_invoker
ALTER VIEW public.costeo_tarifas_vigentes_v SET (security_invoker = true);

-- 7) Functions: pin search_path
DO $guard$ BEGIN
  IF to_regprocedure('public.enqueue_email(text, jsonb)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.read_email_batch(text, integer, integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.move_to_dlq(text, text, bigint, jsonb)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.delete_email(text, bigint)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq';
  END IF;
END $guard$;
ALTER FUNCTION public._docs_requeridos_por_estado(text, text) SET search_path = public;
