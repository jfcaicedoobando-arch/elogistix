-- ============================================================================
-- Ola 16 · Plano tenant en RPCs SECURITY DEFINER de papelera / bitácora
-- Estas funciones eluden RLS, así que la política RESTRICTIVE no las alcanza:
-- se re-emiten cambiando `current_user_org_id() OR super_admin` por
-- `public.org_scope()` (tenant activo del super admin, org propia del resto).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_trash(_table text, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, organization_id uuid, deleted_at timestamp with time zone, deleted_by uuid, deleted_by_email text, label text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _scope uuid;
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

  _scope := public.org_scope();
  IF _scope IS NULL THEN
    RETURN;  -- super admin sin tenant activo: nunca mezclar organizaciones
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
       AND t.organization_id = $1
     ORDER BY t.deleted_at DESC
     LIMIT $2 OFFSET $3',
    _label_col, '', '(sin etiqueta)', _table
  ) USING _scope, _limit, _offset;
END $function$;

CREATE OR REPLACE FUNCTION public.list_trash_counts()
 RETURNS TABLE(tabla text, total bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _scope uuid;
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

  _scope := public.org_scope();
  IF _scope IS NULL THEN
    RETURN;
  END IF;

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
      'SELECT count(*)::bigint FROM public.%I WHERE deleted_at IS NOT NULL AND organization_id = $1',
      _t
    );
    EXECUTE _sql INTO _n USING _scope;
    tabla := _t;
    total := _n;
    RETURN NEXT;
  END LOOP;
END;
$function$;

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

  EXECUTE format('UPDATE public.%I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1', _table)
    USING _id;
END;
$function$;

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

  IF _org IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_ORG_FUERA_DE_SCOPE: el registro pertenece a otra organización';
  END IF;

  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR public.has_role(_uid, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sólo admin / super_admin pueden purgar';
  END IF;

  EXECUTE format('DELETE FROM public.%I WHERE id = $1', _table)
    USING _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_record(_table text, _id uuid)
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

  EXECUTE format('UPDATE public.%I SET deleted_at = now(), deleted_by = $1 WHERE id = $2', _table)
    USING _uid, _id;
END $function$;

CREATE OR REPLACE FUNCTION public.list_idempotency_log(_limit integer DEFAULT 100, _offset integer DEFAULT 0)
 RETURNS TABLE(key uuid, fn text, hits integer, created_at timestamp with time zone, user_id uuid, user_email text, has_response boolean, pending boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scope uuid := public.org_scope();
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden: requires admin role';
  END IF;
  IF v_scope IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    ik.key,
    ik.fn,
    ik.hits,
    ik.created_at,
    ik.user_id,
    u.email::text AS user_email,
    (ik.response IS NOT NULL AND NOT COALESCE((ik.response ? '__idempotency_pending'), false)) AS has_response,
    COALESCE((ik.response ? '__idempotency_pending'), ik.response IS NULL) AS pending
  FROM public.idempotency_keys ik
  LEFT JOIN auth.users u ON u.id = ik.user_id
  WHERE ik.organization_id = v_scope
  ORDER BY ik.created_at DESC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$function$;

-- ============================================================================
-- Plano PLATAFORMA: totales globales para el tablero /admin (sólo super admin).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_admin_platform_stats()
RETURNS TABLE(total_orgs bigint, total_users bigint, total_embarques bigint, total_cotizaciones bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_SOLO_SUPER_ADMIN: telemetría de plataforma restringida';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.organizations),
    (SELECT count(*) FROM public.organization_members),
    (SELECT count(*) FROM public.embarques WHERE deleted_at IS NULL),
    (SELECT count(*) FROM public.cotizaciones WHERE deleted_at IS NULL);
END;
$function$;

COMMENT ON FUNCTION public.fn_admin_platform_stats() IS
  'Ola 16 · plano plataforma: totales globales del tablero /admin. Fail-closed para no super admins.';

REVOKE ALL ON FUNCTION public.fn_admin_platform_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_admin_platform_stats() TO authenticated, service_role;
