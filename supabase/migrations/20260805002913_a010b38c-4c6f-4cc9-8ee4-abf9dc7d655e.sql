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

  -- Idempotencia: el trigger trg_cerrar_entrantes_por_uuid pudo cerrar ya este
  -- documento contra la misma factura. En ese caso no hay nada que hacer.
  IF v_doc.estado = 'capturada' AND v_doc.proveedor_factura_id = p_factura_id THEN
    RETURN;
  END IF;

  IF v_doc.estado = 'capturada' THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento ya está vinculado a otra factura de proveedor';
  END IF;

  IF v_doc.estado = 'rechazada' THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento fue rechazado; solicita que se vuelva a subir';
  END IF;

  IF v_doc.estado <> 'por_capturar' THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento no está disponible para captura';
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
END;
$function$;

REVOKE ALL ON FUNCTION public.capturar_factura_entrante(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capturar_factura_entrante(uuid, uuid) TO authenticated;