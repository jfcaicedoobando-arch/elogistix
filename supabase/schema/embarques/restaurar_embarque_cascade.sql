-- Preserve the existing restore authority and timestamp-based cascade. The
-- parent must be active before its financial children can be reactivated.
CREATE OR REPLACE FUNCTION public.restaurar_embarque_cascade(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_locked_org uuid;
  v_deleted_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT organization_id INTO v_org
    FROM public.embarques
   WHERE id = p_embarque_id AND deleted_at IS NOT NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado en papelera';
  END IF;
  -- Keep the legacy restore role gate, independently of delete capabilities.
  IF (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR (v_org = public.current_user_org_id()
        AND (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'operador'::app_role)))
  ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  -- Use the same org-before-parent order as deletion. The mutex enforces RC;
  -- writers still reject contention instead of waiting with child rows locked.
  PERFORM public._h14_mutex_baja_embarque(v_org, true);
  SELECT organization_id, deleted_at INTO v_locked_org, v_deleted_at
    FROM public.embarques WHERE id = p_embarque_id FOR UPDATE;
  IF NOT FOUND OR v_deleted_at IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado en papelera';
  END IF;
  IF v_locked_org IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: el embarque cambió de organización; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END IF;
  -- A waiter must not retain a revoked role, a changed identity or a stale org.
  IF auth.uid() IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR (v_locked_org = public.current_user_org_id()
        AND (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'operador'::app_role)))
  ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  -- D-01: official restore gate only. No financial writer bypass is added.
  -- All changes, including the parent and this local setting, roll back if any
  -- child fails. Recapture the deletion episode only after locking the parent.
  PERFORM set_config('app.papelera_restore', 'on', true);
  UPDATE public.embarques SET deleted_at = NULL, deleted_by = NULL WHERE id = p_embarque_id;
  UPDATE public.conceptos_venta       SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.conceptos_costo       SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.documentos_embarque   SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.notas_embarque        SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.eventos_embarque      SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.embarque_contenedores SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.facturas              SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.seguros_embarque      SET deleted_at = NULL                    WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  PERFORM set_config('app.papelera_restore', 'off', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.restaurar_embarque_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restaurar_embarque_cascade(uuid) TO authenticated, service_role, postgres;
