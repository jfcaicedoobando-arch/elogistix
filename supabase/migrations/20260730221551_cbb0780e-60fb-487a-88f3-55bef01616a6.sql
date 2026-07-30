-- 1) Normalización de datos existentes
UPDATE public.proveedor_facturas
   SET uuid_fiscal = upper(btrim(uuid_fiscal))
 WHERE uuid_fiscal IS NOT NULL
   AND uuid_fiscal <> upper(btrim(uuid_fiscal));

UPDATE public.embarque_facturas_entrantes
   SET uuid_fiscal = upper(btrim(uuid_fiscal))
 WHERE uuid_fiscal IS NOT NULL
   AND uuid_fiscal <> upper(btrim(uuid_fiscal));

-- 2) Trigger de normalización (idempotente)
CREATE OR REPLACE FUNCTION public._normalizar_uuid_fiscal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.uuid_fiscal IS NOT NULL THEN
    NEW.uuid_fiscal := NULLIF(upper(btrim(NEW.uuid_fiscal)), '');
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._normalizar_uuid_fiscal() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_pf_normalizar_uuid_fiscal ON public.proveedor_facturas;
CREATE TRIGGER trg_pf_normalizar_uuid_fiscal
  BEFORE INSERT OR UPDATE OF uuid_fiscal ON public.proveedor_facturas
  FOR EACH ROW EXECUTE FUNCTION public._normalizar_uuid_fiscal();

DROP TRIGGER IF EXISTS trg_efe_normalizar_uuid_fiscal ON public.embarque_facturas_entrantes;
CREATE TRIGGER trg_efe_normalizar_uuid_fiscal
  BEFORE INSERT OR UPDATE OF uuid_fiscal ON public.embarque_facturas_entrantes
  FOR EACH ROW EXECUTE FUNCTION public._normalizar_uuid_fiscal();

-- 3) Índices únicos insensibles a mayúsculas
DROP INDEX IF EXISTS public.ux_proveedor_facturas_uuid_fiscal_org;
CREATE UNIQUE INDEX IF NOT EXISTS ux_proveedor_facturas_uuid_fiscal_org
  ON public.proveedor_facturas (organization_id, upper(btrim(uuid_fiscal)))
  WHERE uuid_fiscal IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS public.uq_efe_uuid_fiscal;
CREATE UNIQUE INDEX IF NOT EXISTS uq_efe_uuid_fiscal
  ON public.embarque_facturas_entrantes (organization_id, upper(btrim(uuid_fiscal)))
  WHERE uuid_fiscal IS NOT NULL AND deleted_at IS NULL;

-- 4) Lookup seguro del duplicado (evita mensajes genéricos en la UI)
CREATE OR REPLACE FUNCTION public.buscar_factura_proveedor_por_uuid(p_uuid text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.current_user_org_id();
  v_uuid text := NULLIF(upper(btrim(COALESCE(p_uuid, ''))), '');
  v_out jsonb := NULL;
BEGIN
  IF v_uuid IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT (public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')
          OR public.has_role(auth.uid(), 'tesorero')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'admin_org')
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'id', f.id,
           'folio_interno', f.folio_interno,
           'folio_proveedor', f.folio_proveedor,
           'proveedor_nombre', f.proveedor_nombre,
           'estado', f.estado,
           'estado_aprobacion', f.estado_aprobacion)
    INTO v_out
    FROM public.proveedor_facturas f
   WHERE upper(btrim(f.uuid_fiscal)) = v_uuid
     AND f.deleted_at IS NULL
     AND (f.organization_id = v_org OR public.has_role(auth.uid(), 'super_admin'))
   LIMIT 1;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.buscar_factura_proveedor_por_uuid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_factura_proveedor_por_uuid(text) TO authenticated;

-- 5) Puerta de validación: comparación normalizada
CREATE OR REPLACE FUNCTION public.validar_captura_entrante(p_documento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_doc public.embarque_facturas_entrantes%ROWTYPE;
  v_motivos text[] := ARRAY[]::text[];
  v_dup jsonb := NULL;
  v_proveedor jsonb := NULL;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'admin_org')
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'LC_FORBIDDEN',
      'motivos', to_jsonb(ARRAY['Tu rol no puede capturar facturas de proveedor.']));
  END IF;

  SELECT * INTO v_doc FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'LC_NOT_FOUND',
      'motivos', to_jsonb(ARRAY['El documento ya no existe en el buzón.']));
  END IF;

  IF v_doc.organization_id <> v_caller_org AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'LC_FORBIDDEN',
      'motivos', to_jsonb(ARRAY['El documento pertenece a otra organización.']));
  END IF;

  IF v_doc.estado <> 'por_capturar' THEN
    v_motivos := v_motivos || format('El documento ya fue %s.', v_doc.estado);
  END IF;

  IF v_doc.uuid_fiscal IS NOT NULL THEN
    SELECT jsonb_build_object(
             'id', f.id, 'folio_interno', f.folio_interno,
             'folio_proveedor', f.folio_proveedor, 'proveedor_nombre', f.proveedor_nombre,
             'estado', f.estado)
      INTO v_dup
      FROM public.proveedor_facturas f
     WHERE upper(btrim(f.uuid_fiscal)) = upper(btrim(v_doc.uuid_fiscal))
       AND f.deleted_at IS NULL
       AND f.organization_id = v_doc.organization_id
     LIMIT 1;
    IF v_dup IS NOT NULL THEN
      v_motivos := v_motivos || 'Este CFDI ya está capturado en otra factura de proveedor.';
    END IF;
  END IF;

  IF v_doc.rfc_emisor IS NOT NULL THEN
    SELECT jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rfc', p.rfc)
      INTO v_proveedor
      FROM public.proveedores p
     WHERE p.organization_id = v_doc.organization_id
       AND upper(btrim(p.rfc)) = upper(btrim(v_doc.rfc_emisor))
       AND p.deleted_at IS NULL
     LIMIT 1;
  END IF;

  IF v_doc.proveedor_id IS NOT NULL AND v_proveedor IS NULL THEN
    SELECT jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rfc', p.rfc)
      INTO v_proveedor
      FROM public.proveedores p
     WHERE p.id = v_doc.proveedor_id AND p.deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', cardinality(v_motivos) = 0,
    'codigo', CASE WHEN cardinality(v_motivos) = 0 THEN 'OK' ELSE 'LC_VALIDACION' END,
    'motivos', to_jsonb(v_motivos),
    'documento', jsonb_build_object(
      'id', v_doc.id,
      'embarque_id', v_doc.embarque_id,
      'estado', v_doc.estado,
      'uuid_fiscal', v_doc.uuid_fiscal,
      'rfc_emisor', v_doc.rfc_emisor,
      'folio_detectado', COALESCE(v_doc.folio_serie, v_doc.folio_detectado),
      'fecha_emision', v_doc.fecha_emision,
      'total_detectado', v_doc.total_detectado,
      'moneda_detectada', v_doc.moneda_detectada,
      'archivo_path', v_doc.archivo_path,
      'xml_path', v_doc.xml_path,
      'nombre_archivo', v_doc.nombre_archivo
    ),
    'proveedor', v_proveedor,
    'factura_duplicada', v_dup
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.validar_captura_entrante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_captura_entrante(uuid) TO authenticated;