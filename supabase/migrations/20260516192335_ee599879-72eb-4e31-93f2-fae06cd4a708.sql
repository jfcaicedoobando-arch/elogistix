
-- ============================================================
-- A.2.2 — Soft delete: hide deleted rows + RPCs
-- ============================================================

-- 1) RESTRICTIVE policies: hide deleted rows from SELECT/UPDATE/DELETE
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clientes','contactos_cliente','embarques','documentos_embarque',
    'eventos_embarque','notas_embarque','cotizaciones','cotizacion_costos',
    'facturas','conceptos_factura','proformas','proforma_conceptos_consolidados',
    'conceptos_costo','conceptos_venta'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Hide soft deleted %I" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Hide soft deleted %I" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

-- 2) Helper: check table is whitelisted
CREATE OR REPLACE FUNCTION public.is_soft_delete_table(_table text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _table = ANY(ARRAY[
    'clientes','contactos_cliente','embarques','documentos_embarque',
    'eventos_embarque','notas_embarque','cotizaciones','cotizacion_costos',
    'facturas','conceptos_factura','proformas','proforma_conceptos_consolidados',
    'conceptos_costo','conceptos_venta'
  ])
$$;

-- 3) soft_delete_record
CREATE OR REPLACE FUNCTION public.soft_delete_record(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
  _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_soft_delete_table(_table) THEN
    RAISE EXCEPTION 'Tabla no permitida para soft delete: %', _table;
  END IF;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  EXECUTE format('SELECT organization_id FROM public.%I WHERE id = $1 AND deleted_at IS NULL', _table)
    INTO _org USING _id;

  IF _org IS NULL THEN
    RAISE EXCEPTION 'Registro no encontrado o ya borrado';
  END IF;

  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR (_org = public.current_user_org_id()
        AND (public.has_role(_uid, 'admin'::app_role) OR public.has_role(_uid, 'operador'::app_role)))
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  EXECUTE format('UPDATE public.%I SET deleted_at = now(), deleted_by = $1 WHERE id = $2', _table)
    USING _uid, _id;
END $$;

-- 4) restore_record
CREATE OR REPLACE FUNCTION public.restore_record(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END $$;

-- 5) purge_record (hard delete — admin only)
CREATE OR REPLACE FUNCTION public.purge_record(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END $$;

-- 6) list_trash (admin only)
CREATE OR REPLACE FUNCTION public.list_trash(_table text, _limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS TABLE(id uuid, organization_id uuid, deleted_at timestamptz, deleted_by uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_soft_delete_table(_table) THEN
    RAISE EXCEPTION 'Tabla no permitida: %', _table;
  END IF;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR public.has_role(_uid, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sólo admin / super_admin';
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT id, organization_id, deleted_at, deleted_by
     FROM public.%I
     WHERE deleted_at IS NOT NULL
       AND (organization_id = public.current_user_org_id() OR public.has_role($1, ''super_admin''::app_role))
     ORDER BY deleted_at DESC
     LIMIT $2 OFFSET $3', _table
  ) USING _uid, _limit, _offset;
END $$;

GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_record(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_record(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_trash(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_soft_delete_table(text) TO authenticated;
