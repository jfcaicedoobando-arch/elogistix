
DROP FUNCTION IF EXISTS public.list_trash(text, integer, integer);

CREATE OR REPLACE FUNCTION public.list_trash(_table text, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE(
  id uuid,
  organization_id uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  deleted_by_email text,
  label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _label_col text;
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

  _label_col := CASE _table
    WHEN 'clientes' THEN 'nombre'
    WHEN 'contactos_cliente' THEN 'nombre'
    WHEN 'embarques' THEN 'expediente'
    WHEN 'documentos_embarque' THEN 'nombre'
    WHEN 'eventos_embarque' THEN 'descripcion'
    WHEN 'notas_embarque' THEN 'contenido'
    WHEN 'cotizaciones' THEN 'folio'
    WHEN 'cotizacion_costos' THEN 'concepto'
    WHEN 'facturas' THEN 'numero'
    WHEN 'conceptos_factura' THEN 'descripcion'
    WHEN 'proformas' THEN 'numero'
    WHEN 'proforma_conceptos_consolidados' THEN 'descripcion'
    WHEN 'conceptos_costo' THEN 'concepto'
    WHEN 'conceptos_venta' THEN 'descripcion'
    ELSE 'id'
  END;

  RETURN QUERY EXECUTE format(
    'SELECT t.id, t.organization_id, t.deleted_at, t.deleted_by,
            (SELECT u.email::text FROM auth.users u WHERE u.id = t.deleted_by) AS deleted_by_email,
            COALESCE(NULLIF(t.%I::text, %L), %L) AS label
     FROM public.%I t
     WHERE t.deleted_at IS NOT NULL
       AND (t.organization_id = public.current_user_org_id() OR public.has_role($1, ''super_admin''::app_role))
     ORDER BY t.deleted_at DESC
     LIMIT $2 OFFSET $3',
    _label_col, '', '(sin etiqueta)', _table
  ) USING _uid, _limit, _offset;
END $function$;
