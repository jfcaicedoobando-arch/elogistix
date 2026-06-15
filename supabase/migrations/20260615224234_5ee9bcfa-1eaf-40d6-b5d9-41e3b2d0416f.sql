
-- 1) Helper inmutable: matriz canónica modo × estado → documentos requeridos
CREATE OR REPLACE FUNCTION public._docs_requeridos_por_estado(p_modo text, p_estado text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_estado
    WHEN 'Confirmado' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque']
        ELSE                  ARRAY['Factura Comercial','Packing List']
      END
    WHEN 'En Tránsito' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'En Aduana' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'Llegada' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'Arribo' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'En Proceso' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'Entregado' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'EIR' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    WHEN 'Cerrado' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
      END
    ELSE ARRAY[]::text[]
  END;
$$;

REVOKE EXECUTE ON FUNCTION public._docs_requeridos_por_estado(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._docs_requeridos_por_estado(text, text) TO authenticated, service_role;

-- 2) Función pública: faltantes de un embarque para un estado destino
CREATE OR REPLACE FUNCTION public.embarque_docs_faltantes(p_embarque_id uuid, p_estado_destino text)
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_modo text;
  v_org_id uuid;
  v_required text[];
  v_faltantes text[];
BEGIN
  IF p_embarque_id IS NULL OR p_estado_destino IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT modo::text, organization_id INTO v_modo, v_org_id
  FROM embarques WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;
  PERFORM public._assert_internal_reader(v_org_id);

  v_required := public._docs_requeridos_por_estado(v_modo, p_estado_destino);
  IF v_required IS NULL OR array_length(v_required, 1) IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT COALESCE(array_agg(req ORDER BY req), ARRAY[]::text[])
  INTO v_faltantes
  FROM unnest(v_required) AS req
  WHERE NOT EXISTS (
    SELECT 1 FROM documentos_embarque d
    WHERE d.embarque_id = p_embarque_id
      AND d.nombre = req
      AND d.deleted_at IS NULL
      AND (d.archivo IS NOT NULL OR d.estado = 'No aplica')
  );

  RETURN v_faltantes;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.embarque_docs_faltantes(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.embarque_docs_faltantes(uuid, text) TO authenticated, service_role;

-- 3) avanzar_estado_embarque — agrega candado bloqueante para estados avanzados
CREATE OR REPLACE FUNCTION public.avanzar_estado_embarque(p_embarque_id uuid, p_nuevo_estado text, p_usuario_email text, p_tipo_evento text, p_descripcion_evento text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  v_faltantes text[];
  v_estados_bloqueantes text[] := ARRAY['En Aduana','Llegada','Arribo','Entregado','EIR','Cerrado'];
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'avanzar_estado_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT organization_id INTO v_org_id FROM embarques WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);

  -- Candado: si el estado destino es avanzado, verifica documentos mínimos.
  IF p_nuevo_estado = ANY(v_estados_bloqueantes) THEN
    v_faltantes := public.embarque_docs_faltantes(p_embarque_id, p_nuevo_estado);
    IF array_length(v_faltantes, 1) IS NOT NULL THEN
      RAISE EXCEPTION 'documentos_faltantes: %', array_to_string(v_faltantes, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE embarques
     SET estado = p_nuevo_estado::estado_embarque, updated_at = now()
   WHERE id = p_embarque_id;

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Estado cambiado a "' || p_nuevo_estado || '"', 'cambio_estado'::tipo_nota, p_usuario_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), p_usuario_email, v_org_id);

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', p_nuevo_estado);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;
