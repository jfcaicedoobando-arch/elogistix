CREATE OR REPLACE FUNCTION public.restore_record(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $_$
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
  IF _org IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_ORG_FUERA_DE_SCOPE: el registro pertenece a otra organización';
  END IF;
  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'operador'::app_role)
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;
  -- D-01: puerta oficial de restauración.
  PERFORM set_config('app.papelera_restore', 'on', true);
  EXECUTE format('UPDATE public.%I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1', _table)
    USING _id;
  PERFORM set_config('app.papelera_restore', 'off', true);
END;
$_$;

REVOKE ALL ON FUNCTION public.restore_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_record(text, uuid) TO authenticated, service_role;