CREATE OR REPLACE FUNCTION public.purgar_embarque_cascade(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_org_mutex uuid;
  v_deleted_at timestamptz;
  v_motivos jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT organization_id, deleted_at INTO v_org, v_deleted_at FROM public.embarques
    WHERE id = p_embarque_id AND deleted_at IS NOT NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Sólo embarques en papelera pueden purgarse'; END IF;
  IF (public.has_role(v_uid, 'super_admin'::public.app_role)
    OR (v_org = public.current_user_org_id() AND public.has_role(v_uid, 'admin'::public.app_role))) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Sólo admin / super_admin pueden purgar';
  END IF;
  v_org_mutex := v_org;
  PERFORM public._h14_mutex_baja_embarque(v_org_mutex, true);
  SELECT organization_id, deleted_at INTO v_org, v_deleted_at FROM public.embarques
    WHERE id = p_embarque_id AND deleted_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sólo embarques en papelera pueden purgarse'; END IF;
  IF v_org IS DISTINCT FROM v_org_mutex THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: el embarque cambió de organización; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END IF;
  IF (public.has_role(v_uid, 'super_admin'::public.app_role)
    OR (v_org = public.current_user_org_id() AND public.has_role(v_uid, 'admin'::public.app_role))) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Sólo admin / super_admin pueden purgar';
  END IF;
  -- Check BEFORE purging any source anchors, otherwise the final parent DELETE
  -- could observe a graph already stripped by this same transaction.
  v_motivos := public._h14_dependencias_baja_embarque(p_embarque_id, v_org,
    v_org = public.current_user_org_id());
  IF v_motivos IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque' USING ERRCODE = '42501';
  END IF;
  IF (v_motivos->>'bloqueado')::boolean IS TRUE THEN
    RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO: el embarque % tiene dependencias fiscales o está cerrado', v_motivos->>'expediente'
      USING HINT = v_motivos::text, ERRCODE = '23514';
  END IF;
  -- Borrar físicamente hijos del mismo lote
  DELETE FROM public.conceptos_venta       WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.conceptos_costo       WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.documentos_embarque   WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.notas_embarque        WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.eventos_embarque      WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.embarque_contenedores WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.facturas              WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  DELETE FROM public.seguros_embarque      WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;

  DELETE FROM public.embarques WHERE id = p_embarque_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.purgar_embarque_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purgar_embarque_cascade(uuid) TO authenticated, service_role, postgres;
