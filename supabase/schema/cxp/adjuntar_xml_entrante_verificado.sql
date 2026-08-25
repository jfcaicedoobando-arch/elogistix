-- Fuente canónica de public.adjuntar_xml_entrante_verificado(...) — Ola 5 · O5.8 (BUG-18).
-- Sólo la edge function `adjuntar-xml-entrante` (service_role) puede ejecutarla:
-- ella descarga el XML de Storage, verifica el hash y RE-PARSEA los metadatos
-- server-side antes de escribirlos. La variante vieja
-- `adjuntar_xml_factura_entrante(...)` deja de estar disponible para
-- `authenticated`, de modo que un cliente ya no puede declarar metadatos
-- fiscales de otro CFDI.
-- FIX3 (tanda 3): el UPDATE sella metadatos_verificados=true y la RPC levanta
-- la GUC transaccional `app.entrante_xml_verificado` (extensión de la
-- verificación server-side al alta inicial del buzón).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.
-- v13.746.4: firma vigente de 12 args (incluye p_subtotal_detectado, sin IVA);
-- la sobrecarga de 11 args quedó eliminada en 20260901000000.

CREATE OR REPLACE FUNCTION public.adjuntar_xml_entrante_verificado(p_documento_id uuid, p_actor uuid, p_xml_path text, p_xml_nombre text, p_xml_hash text, p_uuid_fiscal text DEFAULT NULL::text, p_rfc_emisor text DEFAULT NULL::text, p_folio_serie text DEFAULT NULL::text, p_fecha_emision date DEFAULT NULL::date, p_total_detectado numeric DEFAULT NULL::numeric, p_moneda_detectada text DEFAULT NULL::text, p_subtotal_detectado numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_rol public.app_role;
  c_permitidos public.app_role[] := ARRAY[
    'operador', 'coordinador_logistico', 'gerente_operaciones',
    'contador', 'auxiliar_contable', 'admin', 'admin_org', 'super_admin'
  ]::public.app_role[];
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: actor requerido';
  END IF;

  SELECT organization_id INTO v_org
    FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id
     AND deleted_at IS NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento no existe o fue eliminado';
  END IF;

  IF NOT public.has_role(p_actor, 'super_admin'::public.app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members
        WHERE user_id = p_actor AND organization_id = v_org
     ) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: el usuario no pertenece a la organización del documento';
  END IF;

  v_rol := public.rol_efectivo(p_actor, v_org);
  IF NOT (v_rol = ANY (c_permitidos)
          OR public.has_role(p_actor, 'operador'::public.app_role)
          OR public.has_role(p_actor, 'coordinador_logistico'::public.app_role)
          OR public.has_role(p_actor, 'gerente_operaciones'::public.app_role)
          OR public.has_role(p_actor, 'contador'::public.app_role)
          OR public.has_role(p_actor, 'auxiliar_contable'::public.app_role)
          OR public.has_role(p_actor, 'admin'::public.app_role)
          OR public.has_role(p_actor, 'admin_org'::public.app_role)
          OR public.has_role(p_actor, 'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin permiso para adjuntar XML al buzón'
      USING ERRCODE = '42501';
  END IF;

  IF p_uuid_fiscal IS NOT NULL
     AND p_uuid_fiscal !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'LC_XML_UUID_INVALIDO: el UUID fiscal no tiene formato UUID válido'
      USING ERRCODE = '23514';
  END IF;
  IF p_total_detectado IS NOT NULL AND p_total_detectado <= 0 THEN
    RAISE EXCEPTION 'LC_XML_TOTAL_INVALIDO: el total detectado debe ser mayor a cero'
      USING ERRCODE = '23514';
  END IF;
  IF p_subtotal_detectado IS NOT NULL AND p_subtotal_detectado < 0 THEN
    RAISE EXCEPTION 'LC_XML_SUBTOTAL_INVALIDO: el subtotal detectado no puede ser negativo'
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.entrante_xml_verificado', 'on', true);

  UPDATE public.embarque_facturas_entrantes
     SET xml_path = p_xml_path,
         xml_nombre = p_xml_nombre,
         xml_hash = p_xml_hash,
         uuid_fiscal = p_uuid_fiscal,
         rfc_emisor = p_rfc_emisor,
         folio_serie = p_folio_serie,
         fecha_emision = p_fecha_emision,
         total_detectado = p_total_detectado,
         subtotal_detectado = p_subtotal_detectado,
         moneda_detectada = p_moneda_detectada,
         metadatos_verificados = true
   WHERE id = p_documento_id
     AND organization_id = v_org
     AND estado = 'por_capturar'
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento no existe, ya fue capturado o pertenece a otra organización';
  END IF;
END;
$function$


REVOKE ALL ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text, numeric) TO service_role;

-- BUG-18: cierre del vector. El cliente ya no puede escribir metadatos fiscales
-- directamente; debe pasar por la edge function que re-parsea el XML.
REVOKE EXECUTE ON FUNCTION public.adjuntar_xml_factura_entrante(uuid, text, text, text, text, text, text, date, numeric, text) FROM authenticated;
