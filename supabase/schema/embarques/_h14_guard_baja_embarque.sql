-- Direct table writes must not bypass the RPC predicate. This trigger changes
-- no children, quotes or audit rows: those existing effects remain in the RPC.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_guard_baja_embarque()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_motivos jsonb;
  v_sql_role text := COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text);
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  -- A trusted SQL server role already has table authority. SET ROLE
  -- authenticated in an owner session remains authenticated here.
  IF v_sql_role IN ('postgres', 'service_role') THEN
    v_org := OLD.organization_id;
  ELSE
    v_org := public._h14_assert_actor_baja_embarque(OLD.id);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: la baja requiere una organización estable; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END IF;
  -- The initiating table statement already owns the row lock. Never wait for
  -- the org mutex in the reverse order of the deletion RPC.
  PERFORM public._h14_mutex_baja_embarque(v_org, false);
  IF v_sql_role NOT IN ('postgres', 'service_role') THEN
    PERFORM public._h14_assert_actor_baja_embarque(OLD.id);
  END IF;
  v_motivos := public._h14_dependencias_baja_embarque(OLD.id, v_org,
    v_org = public.current_user_org_id());
  IF v_motivos IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque' USING ERRCODE = '42501';
  END IF;
  IF (v_motivos->>'bloqueado')::boolean IS TRUE THEN
    RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO: el embarque % tiene dependencias fiscales o está cerrado', v_motivos->>'expediente'
      USING HINT = v_motivos::text, ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_guard_baja_embarque() FROM PUBLIC, anon, authenticated, service_role;
