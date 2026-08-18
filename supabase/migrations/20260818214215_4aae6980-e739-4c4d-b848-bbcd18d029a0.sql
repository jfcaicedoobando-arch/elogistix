-- Fix RLS 42501 en cotizaciones (y demás módulos): los roles de
-- organization_members no tenían espejo en user_roles, que es la única fuente
-- que lee public.has_role(). 10 de 19 membresías estaban sin espejo.

CREATE OR REPLACE FUNCTION public._sync_user_roles_desde_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_excluidos text[] := ARRAY['super_admin', 'admin', 'operador', 'viewer'];
  v_old_role  app_role;
  v_user_id   uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_role := OLD.role;
    v_user_id  := OLD.user_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    v_old_role := OLD.role;
    v_user_id  := OLD.user_id;
  END IF;

  -- Retira el espejo anterior sólo si ninguna otra membresía lo respalda.
  IF v_old_role IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = v_user_id
        AND om.role = v_old_role
    ) THEN
      DELETE FROM public.user_roles ur
      WHERE ur.user_id = v_user_id
        AND ur.role = v_old_role;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- Espejo del rol vigente (nunca roles de plataforma ni legacy deprecados).
  IF NOT (NEW.role::text = ANY (v_excluidos)) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, NEW.role)
    ON CONFLICT (user_id) DO UPDATE
      SET role = EXCLUDED.role
      WHERE public.user_roles.role::text NOT IN ('super_admin', 'cliente')
        AND public.user_roles.role IS DISTINCT FROM EXCLUDED.role;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._sync_user_roles_desde_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._sync_user_roles_desde_membership() FROM anon;
REVOKE ALL ON FUNCTION public._sync_user_roles_desde_membership() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sync_user_roles_om_ins ON public.organization_members;
CREATE TRIGGER trg_sync_user_roles_om_ins
AFTER INSERT ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public._sync_user_roles_desde_membership();

DROP TRIGGER IF EXISTS trg_sync_user_roles_om_upd ON public.organization_members;
CREATE TRIGGER trg_sync_user_roles_om_upd
AFTER UPDATE OF role ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public._sync_user_roles_desde_membership();

DROP TRIGGER IF EXISTS trg_sync_user_roles_om_del ON public.organization_members;
CREATE TRIGGER trg_sync_user_roles_om_del
AFTER DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public._sync_user_roles_desde_membership();

-- Backfill idempotente de las membresías sin espejo.
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ON (om.user_id) om.user_id, om.role
FROM public.organization_members om
WHERE om.role::text NOT IN ('super_admin', 'admin', 'operador', 'viewer')
ORDER BY om.user_id, om.role
ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role
  WHERE public.user_roles.role::text NOT IN ('super_admin', 'cliente')
    AND public.user_roles.role IS DISTINCT FROM EXCLUDED.role;
