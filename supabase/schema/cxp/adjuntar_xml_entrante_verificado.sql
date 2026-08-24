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

CREATE OR REPLACE FUNCTION public.adjuntar_xml_entrante_verificado(
  p_documento_id uuid,
  p_actor uuid,
  p_xml_path text,
  p_xml_nombre text,
  p_xml_hash text,
  p_uuid_fiscal text DEFAULT NULL,
  p_rfc_emisor text DEFAULT NULL,
  p_folio_serie text DEFAULT NULL,
  p_fecha_emision date DEFAULT NULL,
  p_total_detectado numeric DEFAULT NULL,
  p_moneda_detectada text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Tenancy: el actor debe ser miembro de la organización del documento
  -- (super_admin es el único rol de plataforma con acceso cross-org).
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

  -- FIX3 (BUG-18 alta inicial): los metadatos vienen RE-PARSEADOS en servidor
  -- por la edge; al escribirlos quedan sellados como verificados. El sello lo
  -- autoriza la GUC transaccional que levanta ESTA RPC — el trigger
  -- trg_entrante_meta_no_verificada fuerza false en cualquier otra vía.
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
$$;

REVOKE ALL ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text) TO service_role;

-- BUG-18: cierre del vector. El cliente ya no puede escribir metadatos fiscales
-- directamente; debe pasar por la edge function que re-parsea el XML.
REVOKE EXECUTE ON FUNCTION public.adjuntar_xml_factura_entrante(uuid, text, text, text, text, text, text, date, numeric, text) FROM authenticated;
