-- Buzón CxP: retirar y reactivar documentos rechazados
CREATE OR REPLACE FUNCTION public.retirar_factura_entrante(p_documento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_es_admin boolean := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin');
  v_doc public.embarque_facturas_entrantes%ROWTYPE;
BEGIN
  IF NOT (v_es_admin
          OR public.has_role(auth.uid(), 'operador')
          OR public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')) THEN
    RAISE EXCEPTION 'LC_ENTRANTE_RETIRO_FORBIDDEN: sin permiso para retirar documentos del buzón';
  END IF;

  SELECT * INTO v_doc FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_NOT_FOUND: documento no encontrado'; END IF;

  IF v_doc.organization_id IS DISTINCT FROM v_caller_org AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: documento de otra organización';
  END IF;

  IF v_doc.estado NOT IN ('por_capturar', 'rechazada') THEN
    RAISE EXCEPTION 'LC_ENTRANTE_RETIRO_CAPTURADA: el documento ya fue capturado como factura de proveedor';
  END IF;

  IF v_doc.proveedor_factura_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ENTRANTE_RETIRO_CAPTURADA: el documento está vinculado a una factura de proveedor';
  END IF;

  IF NOT v_es_admin AND v_doc.subido_por IS DISTINCT FROM auth.uid()
     AND v_doc.estado = 'por_capturar' THEN
    RAISE EXCEPTION 'LC_ENTRANTE_RETIRO_FORBIDDEN: sólo quien subió el archivo o un administrador puede retirarlo';
  END IF;

  UPDATE public.embarque_facturas_entrantes
     SET deleted_at = now()
   WHERE id = p_documento_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reactivar_factura_entrante(p_documento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_doc public.embarque_facturas_entrantes%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'operador')
          OR public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'LC_ENTRANTE_REACTIVAR_FORBIDDEN: sin permiso para devolver documentos al buzón';
  END IF;

  SELECT * INTO v_doc FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_NOT_FOUND: documento no encontrado'; END IF;

  IF v_doc.organization_id IS DISTINCT FROM v_caller_org AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: documento de otra organización';
  END IF;

  IF v_doc.estado <> 'rechazada' THEN
    RAISE EXCEPTION 'LC_ENTRANTE_REACTIVAR_ESTADO: sólo un documento rechazado puede volver a por capturar';
  END IF;

  IF v_doc.proveedor_factura_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ENTRANTE_REACTIVAR_ESTADO: el documento está vinculado a una factura de proveedor';
  END IF;

  UPDATE public.embarque_facturas_entrantes
     SET estado = 'por_capturar',
         rechazo_motivo = NULL,
         capturado_por = NULL
   WHERE id = p_documento_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.retirar_factura_entrante(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reactivar_factura_entrante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retirar_factura_entrante(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivar_factura_entrante(uuid) TO authenticated;