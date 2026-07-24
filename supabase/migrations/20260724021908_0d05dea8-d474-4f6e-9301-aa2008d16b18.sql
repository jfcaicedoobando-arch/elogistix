
-- =========================================================================
-- FASE 3: Bloqueo de INSERT de roles legacy en organization_members / user_roles
-- =========================================================================

CREATE OR REPLACE FUNCTION public._bloquear_rol_legacy_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_texto text := NEW.role::text;
  v_moderno text;
BEGIN
  IF v_rol_texto NOT IN ('admin', 'operador', 'viewer') THEN
    RETURN NEW;
  END IF;

  v_moderno := CASE v_rol_texto
    WHEN 'admin'    THEN 'admin_org'
    WHEN 'operador' THEN 'coordinador_logistico'
    WHEN 'viewer'   THEN 'customer_service'
  END;

  RAISE EXCEPTION 'LC_ROL_LEGACY_BLOQUEADO: el rol "%" está deprecado; usa "%" en su lugar', v_rol_texto, v_moderno
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_rol_legacy_om ON public.organization_members;
CREATE TRIGGER trg_bloquear_rol_legacy_om
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public._bloquear_rol_legacy_insert();

DROP TRIGGER IF EXISTS trg_bloquear_rol_legacy_ur ON public.user_roles;
CREATE TRIGGER trg_bloquear_rol_legacy_ur
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public._bloquear_rol_legacy_insert();

COMMENT ON FUNCTION public._bloquear_rol_legacy_insert IS
  'Fase 3 · Rechaza INSERT con roles legacy (admin/operador/viewer). Los UPDATE siguen permitidos para permitir la migración asistida y reversiones puntuales.';

-- =========================================================================
-- FASE 5: role_change_log (tabla + triggers)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.role_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NULL,
  source text NOT NULL CHECK (source IN ('organization_members', 'user_roles')),
  from_role text NULL,
  to_role text NOT NULL,
  changed_by uuid NULL,
  motivo text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_change_log TO authenticated;
GRANT ALL ON public.role_change_log TO service_role;

ALTER TABLE public.role_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcl_select_propio" ON public.role_change_log;
CREATE POLICY "rcl_select_propio"
  ON public.role_change_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "rcl_select_admin_org" ON public.role_change_log;
CREATE POLICY "rcl_select_admin_org"
  ON public.role_change_log
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = role_change_log.organization_id
        AND om.role::text IN ('admin', 'admin_org')
    )
  );

DROP POLICY IF EXISTS "rcl_select_super_admin" ON public.role_change_log;
CREATE POLICY "rcl_select_super_admin"
  ON public.role_change_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_rcl_user_id_created_at
  ON public.role_change_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rcl_org_created_at
  ON public.role_change_log(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- Trigger para organization_members
CREATE OR REPLACE FUNCTION public._log_role_change_om()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.role_change_log
      (user_id, organization_id, source, from_role, to_role, changed_by)
    VALUES
      (NEW.user_id, NEW.organization_id, 'organization_members', OLD.role::text, NEW.role::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_role_change_om ON public.organization_members;
CREATE TRIGGER trg_log_role_change_om
  AFTER UPDATE OF role ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public._log_role_change_om();

-- Trigger para user_roles (rol global; sin organization_id)
CREATE OR REPLACE FUNCTION public._log_role_change_ur()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.role_change_log
      (user_id, organization_id, source, from_role, to_role, changed_by)
    VALUES
      (NEW.user_id, NULL, 'user_roles', OLD.role::text, NEW.role::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_role_change_ur ON public.user_roles;
CREATE TRIGGER trg_log_role_change_ur
  AFTER UPDATE OF role ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public._log_role_change_ur();

COMMENT ON TABLE public.role_change_log IS
  'Fase 5 · Historial inmutable de cambios de rol. Se llena automáticamente por triggers AFTER UPDATE OF role en organization_members y user_roles.';

-- H6: REVOKE/GRANT para funciones SECURITY DEFINER (trigger helpers)
REVOKE ALL ON FUNCTION public._bloquear_rol_legacy_insert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bloquear_rol_legacy_insert() TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public._log_role_change_om() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._log_role_change_om() TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public._log_role_change_ur() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._log_role_change_ur() TO authenticated, service_role, postgres;
