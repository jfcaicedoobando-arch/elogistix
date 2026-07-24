-- Migración: RPCs para migrar roles legacy → modernos
-- Mapa canónico:
--   admin    → admin_org
--   operador → coordinador_logistico
--   viewer   → customer_service

CREATE OR REPLACE FUNCTION public.migrar_roles_legacy_dry_run()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_om jsonb;
  v_ur jsonb;
  v_total int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo super_admin puede ejecutar esta operación'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_om FROM (
    SELECT om.id,
           om.user_id,
           om.organization_id,
           om.role::text AS rol_actual,
           CASE om.role::text
             WHEN 'admin'    THEN 'admin_org'
             WHEN 'operador' THEN 'coordinador_logistico'
             WHEN 'viewer'   THEN 'customer_service'
           END AS rol_propuesto,
           o.nombre AS organizacion
    FROM public.organization_members om
    LEFT JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.role::text IN ('admin','operador','viewer')
    ORDER BY om.created_at
  ) x;

  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_ur FROM (
    SELECT ur.id,
           ur.user_id,
           ur.role::text AS rol_actual,
           CASE ur.role::text
             WHEN 'admin'    THEN 'admin_org'
             WHEN 'operador' THEN 'coordinador_logistico'
             WHEN 'viewer'   THEN 'customer_service'
           END AS rol_propuesto
    FROM public.user_roles ur
    WHERE ur.role::text IN ('admin','operador','viewer')
  ) x;

  v_total := jsonb_array_length(v_om) + jsonb_array_length(v_ur);

  RETURN jsonb_build_object(
    'total_afectados', v_total,
    'organization_members', v_om,
    'user_roles', v_ur,
    'mapa', jsonb_build_object(
      'admin', 'admin_org',
      'operador', 'coordinador_logistico',
      'viewer', 'customer_service'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.migrar_roles_legacy_dry_run() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrar_roles_legacy_dry_run() TO authenticated;

CREATE OR REPLACE FUNCTION public.migrar_roles_legacy_ejecutar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_om_admin int := 0;
  v_om_operador int := 0;
  v_om_viewer int := 0;
  v_ur_admin int := 0;
  v_ur_operador int := 0;
  v_ur_viewer int := 0;
  v_total int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo super_admin puede ejecutar esta operación'
      USING ERRCODE = '42501';
  END IF;

  -- organization_members
  WITH upd AS (
    UPDATE public.organization_members
       SET role = 'admin_org'::public.app_role
     WHERE role::text = 'admin'
     RETURNING 1
  ) SELECT COUNT(*) INTO v_om_admin FROM upd;

  WITH upd AS (
    UPDATE public.organization_members
       SET role = 'coordinador_logistico'::public.app_role
     WHERE role::text = 'operador'
     RETURNING 1
  ) SELECT COUNT(*) INTO v_om_operador FROM upd;

  WITH upd AS (
    UPDATE public.organization_members
       SET role = 'customer_service'::public.app_role
     WHERE role::text = 'viewer'
     RETURNING 1
  ) SELECT COUNT(*) INTO v_om_viewer FROM upd;

  -- user_roles
  WITH upd AS (
    UPDATE public.user_roles
       SET role = 'admin_org'::public.app_role
     WHERE role::text = 'admin'
     RETURNING 1
  ) SELECT COUNT(*) INTO v_ur_admin FROM upd;

  WITH upd AS (
    UPDATE public.user_roles
       SET role = 'coordinador_logistico'::public.app_role
     WHERE role::text = 'operador'
     RETURNING 1
  ) SELECT COUNT(*) INTO v_ur_operador FROM upd;

  WITH upd AS (
    UPDATE public.user_roles
       SET role = 'customer_service'::public.app_role
     WHERE role::text = 'viewer'
     RETURNING 1
  ) SELECT COUNT(*) INTO v_ur_viewer FROM upd;

  v_total := v_om_admin + v_om_operador + v_om_viewer
           + v_ur_admin + v_ur_operador + v_ur_viewer;

  -- Bitácora (best-effort; si la tabla no existe o falla, no rompemos la migración)
  BEGIN
    INSERT INTO public.bitacora_actividad (
      user_id, accion, entidad, entidad_id, detalles
    ) VALUES (
      auth.uid(),
      'migrar_roles_legacy',
      'roles',
      NULL,
      jsonb_build_object(
        'organization_members', jsonb_build_object(
          'admin_a_admin_org', v_om_admin,
          'operador_a_coordinador_logistico', v_om_operador,
          'viewer_a_customer_service', v_om_viewer
        ),
        'user_roles', jsonb_build_object(
          'admin_a_admin_org', v_ur_admin,
          'operador_a_coordinador_logistico', v_ur_operador,
          'viewer_a_customer_service', v_ur_viewer
        ),
        'total', v_total
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- No bloqueamos la migración por un fallo de bitácora.
    NULL;
  END;

  RETURN jsonb_build_object(
    'ejecutado_at', now(),
    'total_migrados', v_total,
    'organization_members', jsonb_build_object(
      'admin_a_admin_org', v_om_admin,
      'operador_a_coordinador_logistico', v_om_operador,
      'viewer_a_customer_service', v_om_viewer
    ),
    'user_roles', jsonb_build_object(
      'admin_a_admin_org', v_ur_admin,
      'operador_a_coordinador_logistico', v_ur_operador,
      'viewer_a_customer_service', v_ur_viewer
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.migrar_roles_legacy_ejecutar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrar_roles_legacy_ejecutar() TO authenticated;

COMMENT ON FUNCTION public.migrar_roles_legacy_dry_run() IS
  'Vista previa de la migración de roles legacy a modernos. Solo super_admin.';
COMMENT ON FUNCTION public.migrar_roles_legacy_ejecutar() IS
  'Ejecuta la migración de roles legacy (admin/operador/viewer) a modernos (admin_org/coordinador_logistico/customer_service). Solo super_admin.';