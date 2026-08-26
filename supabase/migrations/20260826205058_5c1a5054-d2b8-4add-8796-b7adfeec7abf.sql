-- =====================================================================
-- D-01 · Candado a la columna `deleted_at` (papelera a prueba de manos)
-- Se controlan las TRANSICIONES válidas de deleted_at:
--   1. valor -> NULL  => LC_RESTORE_DIRECTO (sólo vía Papelera)
--   2. NULL -> valor  => se normaliza a now() (sin backdating) + deleted_by real
--   3. valor -> otro  => LC_DELETED_AT_INMUTABLE
-- Sólo se enforcea para roles de la API de datos (authenticated / anon).
-- =====================================================================

CREATE OR REPLACE FUNCTION public._guard_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new jsonb;
  v_uid uuid;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(current_setting('app.papelera_restore', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN NEW;
  END IF;

  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'LC_RESTORE_DIRECTO: para restaurar este registro usa la Papelera'
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_DELETED_AT_INMUTABLE: la fecha de borrado de un registro en papelera no se puede modificar'
      USING ERRCODE = 'P0001';
  END IF;

  v_uid := auth.uid();
  v_new := to_jsonb(NEW) || jsonb_build_object('deleted_at', now());
  IF v_new ? 'deleted_by' AND v_uid IS NOT NULL THEN
    v_new := v_new || jsonb_build_object('deleted_by', v_uid);
  END IF;
  NEW := jsonb_populate_record(NEW, v_new);

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._guard_soft_delete() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._guard_soft_delete() TO authenticated, service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'deleted_at' AND a.attnum > 0 AND NOT a.attisdropped
     WHERE c.relkind = 'r'
       AND public.is_soft_delete_table(c.relname)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guard_soft_delete ON public.%I', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_guard_soft_delete BEFORE UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public._guard_soft_delete()',
      r.table_name
    );
  END LOOP;
END $$;

-- =====================================================================
-- Puerta oficial: las funciones de restauración marcan la sesión.
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

  -- D-01: puerta oficial de restauración.
  PERFORM set_config('app.papelera_restore', 'on', true);
  EXECUTE format('UPDATE public.%I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1', _table)
    USING _id;
  PERFORM set_config('app.papelera_restore', 'off', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_record(text, uuid) TO authenticated, service_role;

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

  -- D-01: puerta oficial de restauración.
  PERFORM set_config('app.papelera_restore', 'on', true);

  UPDATE public.conceptos_venta       SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.conceptos_costo       SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.documentos_embarque   SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.notas_embarque        SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.eventos_embarque      SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.embarque_contenedores SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.facturas              SET deleted_at = NULL, deleted_by = NULL WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;
  UPDATE public.seguros_embarque      SET deleted_at = NULL                    WHERE embarque_id = p_embarque_id AND deleted_at = v_deleted_at;

  UPDATE public.embarques SET deleted_at = NULL, deleted_by = NULL WHERE id = p_embarque_id;

  PERFORM set_config('app.papelera_restore', 'off', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.restaurar_embarque_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restaurar_embarque_cascade(uuid) TO authenticated, service_role;