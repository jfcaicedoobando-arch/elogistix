-- Fuente canónica de public.soft_delete_record.
CREATE OR REPLACE FUNCTION public.soft_delete_record(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _org uuid;
  _uid uuid := auth.uid();
  _deps bigint;
  _estado text;
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

  IF _table = 'clientes' THEN
    SELECT
      (SELECT count(*) FROM public.embarques e WHERE e.cliente_id = _id AND e.deleted_at IS NULL)
      + (SELECT count(*) FROM public.facturas f WHERE f.cliente_id = _id AND f.deleted_at IS NULL)
      + (SELECT count(*) FROM public.cotizaciones c WHERE c.cliente_id = _id AND c.deleted_at IS NULL)
      INTO _deps;
  ELSIF _table = 'embarques' THEN
    SELECT
      (SELECT count(*) FROM public.facturas f WHERE f.embarque_id = _id AND f.deleted_at IS NULL)
      + (SELECT count(*) FROM public.proveedor_facturas pf
         WHERE pf.embarque_id = _id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada')
      INTO _deps;
  ELSIF _table = 'facturas' THEN
    SELECT f.estado::text INTO _estado FROM public.facturas f WHERE f.id = _id;
    IF _estado IS DISTINCT FROM 'Borrador' THEN
      RAISE EXCEPTION 'LC_BAJA_CON_DEPENDENCIAS: sólo facturas en Borrador pueden eliminarse; cancela o sustituye el CFDI'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF COALESCE(_deps, 0) > 0 THEN
    RAISE EXCEPTION 'LC_BAJA_CON_DEPENDENCIAS: el registro tiene % dependencias vivas', _deps
      USING ERRCODE = 'P0001';
  END IF;

  EXECUTE format('UPDATE public.%I SET deleted_at = now(), deleted_by = $1 WHERE id = $2', _table)
    USING _uid, _id;
END
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO authenticated, service_role;