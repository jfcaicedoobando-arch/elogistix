
-- =====================================================================
-- Papelera Fase 1: convertir eliminar_embarque_completo a soft-delete
-- =====================================================================

CREATE OR REPLACE FUNCTION public.eliminar_embarque_completo(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_uid uuid := auth.uid();
  v_cotizacion_id uuid;
  v_remaining int;
BEGIN
  -- Leer cotizacion_id antes de "eliminar"
  SELECT cotizacion_id INTO v_cotizacion_id
  FROM public.embarques
  WHERE id = p_embarque_id AND deleted_at IS NULL;

  IF v_cotizacion_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.embarques WHERE id = p_embarque_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Embarque % no existe o ya está eliminado', p_embarque_id;
  END IF;

  -- Soft-delete de hijos (mismo timestamp = mismo "lote" para restore/purge)
  UPDATE public.conceptos_venta
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.conceptos_costo
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.documentos_embarque
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.notas_embarque
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.eventos_embarque
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.embarque_contenedores
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.facturas
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  -- seguros_embarque no tiene columna deleted_by
  UPDATE public.seguros_embarque
     SET deleted_at = v_now
   WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  -- Soft-delete del embarque padre (mismo timestamp)
  UPDATE public.embarques
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE id = p_embarque_id AND deleted_at IS NULL;

  -- Revertir cotización si no quedan embarques activos vinculados
  IF v_cotizacion_id IS NOT NULL THEN
    SELECT count(*) INTO v_remaining
    FROM public.embarques
    WHERE cotizacion_id = v_cotizacion_id AND deleted_at IS NULL;

    IF v_remaining = 0 THEN
      UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = v_cotizacion_id;
    END IF;
  END IF;
END;
$function$;

-- =====================================================================
-- Cascade restore para embarques: recupera padre + hijos del mismo lote
-- =====================================================================

CREATE OR REPLACE FUNCTION public.restaurar_embarque_cascade(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_deleted_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT organization_id, deleted_at
    INTO v_org, v_deleted_at
    FROM public.embarques
   WHERE id = p_embarque_id AND deleted_at IS NOT NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado en papelera';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR (v_org = public.current_user_org_id()
        AND (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'operador'::app_role)))
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  -- Restaurar hijos del mismo lote (mismo deleted_at exacto)
  UPDATE public.conceptos_venta       SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.conceptos_costo       SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.documentos_embarque   SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.notas_embarque        SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.eventos_embarque      SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.embarque_contenedores SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.facturas              SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.seguros_embarque      SET deleted_at = NULL                    WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;

  -- Restaurar el embarque
  UPDATE public.embarques SET deleted_at = NULL, deleted_by = NULL WHERE id = p_embarque_id;
END;
$function$;

-- =====================================================================
-- Extender restore_record: cuando _table='embarques' delega en cascade
-- =====================================================================

CREATE OR REPLACE FUNCTION public.restore_record(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _org uuid;
  _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_soft_delete_table(_table) THEN
    RAISE EXCEPTION 'Tabla no permitida: %', _table;
  END IF;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Ruta especial: restaurar embarque en cascada (con hijos)
  IF _table = 'embarques' THEN
    PERFORM public.restaurar_embarque_cascade(_id);
    RETURN;
  END IF;

  EXECUTE format('SELECT organization_id FROM public.%I WHERE id = $1 AND deleted_at IS NOT NULL', _table)
    INTO _org USING _id;

  IF _org IS NULL THEN
    RAISE EXCEPTION 'Registro no encontrado en papelera';
  END IF;

  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR (_org = public.current_user_org_id()
        AND (public.has_role(_uid, 'admin'::app_role) OR public.has_role(_uid, 'operador'::app_role)))
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  EXECUTE format('UPDATE public.%I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1', _table)
    USING _id;
END;
$function$;

-- =====================================================================
-- Purge cascade para embarques (borrado físico definitivo desde papelera)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.purgar_embarque_cascade(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_deleted_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT organization_id, deleted_at
    INTO v_org, v_deleted_at
    FROM public.embarques
   WHERE id = p_embarque_id AND deleted_at IS NOT NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sólo embarques en papelera pueden purgarse';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR (v_org = public.current_user_org_id() AND public.has_role(v_uid, 'admin'::app_role))
  ) THEN
    RAISE EXCEPTION 'Sólo admin / super_admin pueden purgar';
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

-- =====================================================================
-- Extender purge_record: cuando _table='embarques' delega en cascade
-- =====================================================================

CREATE OR REPLACE FUNCTION public.purge_record(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _org uuid;
  _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_soft_delete_table(_table) THEN
    RAISE EXCEPTION 'Tabla no permitida: %', _table;
  END IF;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF _table = 'embarques' THEN
    PERFORM public.purgar_embarque_cascade(_id);
    RETURN;
  END IF;

  EXECUTE format('SELECT organization_id FROM public.%I WHERE id = $1 AND deleted_at IS NOT NULL', _table)
    INTO _org USING _id;

  IF _org IS NULL THEN
    RAISE EXCEPTION 'Sólo registros en papelera pueden purgarse';
  END IF;

  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR (_org = public.current_user_org_id() AND public.has_role(_uid, 'admin'::app_role))
  ) THEN
    RAISE EXCEPTION 'Sólo admin / super_admin pueden purgar';
  END IF;

  EXECUTE format('DELETE FROM public.%I WHERE id = $1', _table)
    USING _id;
END;
$function$;

REVOKE ALL ON FUNCTION public.restaurar_embarque_cascade(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purgar_embarque_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurar_embarque_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purgar_embarque_cascade(uuid) TO authenticated;
