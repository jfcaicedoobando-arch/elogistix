-- Internal admission check only. Existing table/RPC permissions still decide
-- whether the caller may write; this helper never grants a write capability.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_validar_actor_org_baja(p_org uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := COALESCE(NULLIF(current_setting('role', true), 'none'), SESSION_USER::text);
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  IF p_org IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  -- SET ROLE authenticated is still authenticated when session_user is postgres
  -- in the isolated tests. Only a genuine effective database owner/service role
  -- skips JWT admission; RC, mutex, references and tombstones remain mandatory.
  IF v_role IN ('postgres', 'service_role') THEN RETURN; END IF;
  v_org := public.current_user_org_id();
  IF v_role <> 'authenticated' OR v_uid IS NULL OR (
    public.has_role(v_uid, 'super_admin'::public.app_role) IS NOT TRUE
    AND (v_org IS NULL OR v_org IS DISTINCT FROM p_org)
  ) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_validar_actor_org_baja(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The graph can initially have no shipment. This org anchor is acquired before
-- resolving it. Hash collisions only add contention; they never merge tenants.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_mutex_baja_embarque(p_org uuid, p_esperar boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key bigint;
BEGIN
  PERFORM public._h14_validar_actor_org_baja(p_org);
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'LC_EMBARQUE_AISLAMIENTO_NO_SOPORTADO: esta operación requiere una transacción READ COMMITTED'
      USING ERRCODE = '25001';
  END IF;
  v_key := hashtextextended('librecarga:h14:grafo-financiero:' || p_org::text, 0);
  IF p_esperar IS TRUE THEN
    PERFORM pg_advisory_xact_lock(v_key);
  ELSIF pg_try_advisory_xact_lock(v_key) IS NOT TRUE THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: los vínculos financieros se están actualizando; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_mutex_baja_embarque(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
