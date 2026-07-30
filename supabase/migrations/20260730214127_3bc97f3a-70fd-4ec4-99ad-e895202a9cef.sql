-- v13.366.0 · Captura de factura de proveedor desde el buzón CxP
-- 1) capturar_factura_entrante ahora hereda también XML / UUID fiscal / RFC.
-- 2) validar_captura_entrante: puerta de validación previa a crear la factura.

CREATE OR REPLACE FUNCTION public.capturar_factura_entrante(p_documento_id uuid, p_factura_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_doc public.embarque_facturas_entrantes%ROWTYPE;
  v_fac_org uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin permiso para capturar facturas entrantes';
  END IF;

  SELECT * INTO v_doc FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_NOT_FOUND: documento no encontrado'; END IF;

  IF v_doc.organization_id <> v_caller_org AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: documento de otra organización';
  END IF;

  IF v_doc.estado <> 'por_capturar' THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento ya fue %', v_doc.estado;
  END IF;

  SELECT organization_id INTO v_fac_org FROM public.proveedor_facturas WHERE id = p_factura_id;
  IF v_fac_org IS NULL THEN RAISE EXCEPTION 'LC_NOT_FOUND: factura de proveedor no encontrada'; END IF;
  IF v_fac_org <> v_doc.organization_id THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: la factura pertenece a otra organización';
  END IF;

  UPDATE public.embarque_facturas_entrantes
     SET estado = 'capturada',
         proveedor_factura_id = p_factura_id,
         capturado_por = auth.uid()
   WHERE id = p_documento_id;

  -- Hereda los archivos y los datos fiscales del documento sin sobrescribir
  -- lo que la factura ya tenga capturado.
  UPDATE public.proveedor_facturas
     SET archivo_pdf_url = COALESCE(archivo_pdf_url, v_doc.archivo_path),
         archivo_xml_url = COALESCE(archivo_xml_url, v_doc.xml_path),
         uuid_fiscal     = COALESCE(uuid_fiscal, v_doc.uuid_fiscal),
         rfc_proveedor   = COALESCE(rfc_proveedor, v_doc.rfc_emisor)
   WHERE id = p_factura_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.capturar_factura_entrante(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capturar_factura_entrante(uuid, uuid) TO authenticated;

-- Puerta de validación previa: se consulta ANTES de abrir el formulario de
-- captura, para no dejar al contador llenar datos que la BD va a rechazar.
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
     WHERE f.uuid_fiscal = v_doc.uuid_fiscal
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