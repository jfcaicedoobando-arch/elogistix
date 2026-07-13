
-- Papelera Fase 2-4

-- 1) Expandir allowlist de tablas soft-delete
CREATE OR REPLACE FUNCTION public.is_soft_delete_table(_table text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT _table = ANY(ARRAY[
    -- Existentes
    'clientes','contactos_cliente','embarques','documentos_embarque',
    'eventos_embarque','notas_embarque','cotizaciones','cotizacion_costos',
    'facturas','conceptos_factura','proformas','proforma_conceptos_consolidados',
    'conceptos_costo','conceptos_venta',
    -- CRM
    'crm_leads','crm_oportunidades','crm_actividades','crm_comentarios_oportunidad',
    'crm_etapas_pipeline','crm_motivos_perdida','crm_plantillas_mensaje',
    -- Finanzas
    'pagos_factura','pagos_proveedor','proveedor_facturas',
    'proveedor_notas_credito','factura_notas_credito','cuentas_bancarias',
    -- Operaciones
    'seguros_embarque','embarque_contenedores'
  ])
$$;

-- 2) Actualizar list_trash con etiquetas para las nuevas tablas
CREATE OR REPLACE FUNCTION public.list_trash(_table text, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, organization_id uuid, deleted_at timestamp with time zone, deleted_by uuid, deleted_by_email text, label text)
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
    WHEN 'crm_leads' THEN 'empresa'
    WHEN 'crm_oportunidades' THEN 'nombre'
    WHEN 'crm_actividades' THEN 'asunto'
    WHEN 'crm_comentarios_oportunidad' THEN 'texto'
    WHEN 'crm_etapas_pipeline' THEN 'nombre'
    WHEN 'crm_motivos_perdida' THEN 'nombre'
    WHEN 'crm_plantillas_mensaje' THEN 'nombre'
    WHEN 'pagos_factura' THEN 'referencia'
    WHEN 'pagos_proveedor' THEN 'referencia'
    WHEN 'proveedor_facturas' THEN 'folio_interno'
    WHEN 'proveedor_notas_credito' THEN 'descripcion'
    WHEN 'factura_notas_credito' THEN 'folio'
    WHEN 'cuentas_bancarias' THEN 'alias'
    WHEN 'seguros_embarque' THEN 'poliza'
    WHEN 'embarque_contenedores' THEN 'numero_contenedor'
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

-- 3) Nueva función: contadores por tabla para el UI
CREATE OR REPLACE FUNCTION public.list_trash_counts()
RETURNS TABLE(tabla text, total bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org uuid;
  _is_super boolean;
  _t text;
  _n bigint;
  _sql text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR public.has_role(_uid, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sólo admin / super_admin';
  END IF;

  _is_super := public.has_role(_uid, 'super_admin'::app_role);
  _org := public.current_user_org_id();

  FOR _t IN
    SELECT unnest(ARRAY[
      'clientes','contactos_cliente','embarques','documentos_embarque',
      'eventos_embarque','notas_embarque','cotizaciones','cotizacion_costos',
      'facturas','conceptos_factura','proformas','proforma_conceptos_consolidados',
      'conceptos_costo','conceptos_venta',
      'crm_leads','crm_oportunidades','crm_actividades','crm_comentarios_oportunidad',
      'crm_etapas_pipeline','crm_motivos_perdida','crm_plantillas_mensaje',
      'pagos_factura','pagos_proveedor','proveedor_facturas',
      'proveedor_notas_credito','factura_notas_credito','cuentas_bancarias',
      'seguros_embarque','embarque_contenedores'
    ])
  LOOP
    _sql := format(
      'SELECT count(*)::bigint FROM public.%I WHERE deleted_at IS NOT NULL AND ($1 OR organization_id = $2)',
      _t
    );
    EXECUTE _sql INTO _n USING _is_super, _org;
    tabla := _t;
    total := _n;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_trash_counts() TO authenticated;
