-- =====================================================================
-- Ola 4 · N28: la ruta /comisiones admite contador/tesorero/gerentes
-- (COMISIONES_ROLES, roleRouteMatrix.ts) pero el backend sólo dejaba pasar
-- admin/super_admin → tabla vacía y acciones rotas para esos roles.
-- Decisión: lectura para finanzas+gerentes; escritura (generar liquidación,
-- registrar pago) para admins + contador/tesorero, vía has_any_role_efectivo
-- (misma semántica que el effectiveRole del frontend).
-- =====================================================================

DROP POLICY IF EXISTS "liq_admin_full" ON public.liquidaciones_comision;
CREATE POLICY "liq_admin_full" ON public.liquidaciones_comision
  FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_any_role_efectivo(auth.uid(),
          ARRAY['admin','admin_org','super_admin','contador','tesorero']::app_role[])
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_any_role_efectivo(auth.uid(),
          ARRAY['admin','admin_org','super_admin','contador','tesorero']::app_role[])
  );

DROP POLICY IF EXISTS "liq_finanzas_read" ON public.liquidaciones_comision;
CREATE POLICY "liq_finanzas_read" ON public.liquidaciones_comision
  FOR SELECT TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_any_role_efectivo(auth.uid(),
          ARRAY['gerente_comercial','gerente_operaciones','gerente_visor']::app_role[])
  );

CREATE OR REPLACE FUNCTION public.generar_liquidacion_comision(
  p_vendedora_id uuid, p_periodo text, p_organization_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric(14,2);
  v_liq_id uuid;
  v_org uuid;
BEGIN
  -- Ola 4 · N28: antes `has_role('admin') OR has_role('super_admin')` — la
  -- ruta /comisiones también admite contador/tesorero; la generación queda
  -- para funciones financieras (gerentes: sólo lectura por RLS).
  IF NOT has_any_role_efectivo(auth.uid(),
        ARRAY['admin','admin_org','super_admin','contador','tesorero']::app_role[]) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;
  PERFORM public._assert_writer(v_org);

  SELECT COALESCE(SUM(comision_mxn), 0) INTO v_total
    FROM comisiones_devengadas
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at, 'YYYY-MM') = p_periodo;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Sin comisiones devengadas para liquidar';
  END IF;

  INSERT INTO liquidaciones_comision (organization_id, vendedora_id, periodo, total_mxn, creada_por)
  VALUES (v_org, p_vendedora_id, p_periodo, v_total, auth.uid())
  RETURNING id INTO v_liq_id;

  UPDATE comisiones_devengadas
     SET estado = 'Liquidada', liquidacion_id = v_liq_id, updated_at = now()
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at, 'YYYY-MM') = p_periodo;

  RETURN v_liq_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid) TO authenticated, service_role;
