-- Fuente canónica de public.adjuntar_xml_factura_entrante(...) (Ola 11 · RNF-08).
-- 1:1 con supabase/migrations/20260813031300_1f4a2b81-412f-49fb-b8dc-5fa802409b9b.sql.
-- La política "Autor edita facturas entrantes pendientes" exige
-- subido_por = auth.uid() OR admin, así que contabilidad — que SÍ conserva
-- "adjuntar XML faltante" — era rechazada con 42501 después de subir el archivo
-- a Storage. Esta RPC aplica la matriz de roles del plan de permisos contables.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.adjuntar_xml_factura_entrante(
  p_documento_id uuid,
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
  v_org uuid := public.org_scope();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: sesión requerida';
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_ORG: no hay organización activa';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'operador')
          OR public.has_role(auth.uid(), 'coordinador_logistico')
          OR public.has_role(auth.uid(), 'gerente_operaciones')
          OR public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'admin_org')
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin permiso para adjuntar XML al buzón';
  END IF;

  -- Check-then-act cerrado: rol, organización y estado dentro del UPDATE.
  UPDATE public.embarque_facturas_entrantes
     SET xml_path = p_xml_path,
         xml_nombre = p_xml_nombre,
         xml_hash = p_xml_hash,
         uuid_fiscal = p_uuid_fiscal,
         rfc_emisor = p_rfc_emisor,
         folio_serie = p_folio_serie,
         fecha_emision = p_fecha_emision,
         total_detectado = p_total_detectado,
         moneda_detectada = p_moneda_detectada
   WHERE id = p_documento_id
     AND organization_id = v_org
     AND estado = 'por_capturar'
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento no existe, ya fue capturado o pertenece a otra organización';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.adjuntar_xml_factura_entrante(uuid, text, text, text, text, text, text, date, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjuntar_xml_factura_entrante(uuid, text, text, text, text, text, text, date, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.adjuntar_xml_factura_entrante(uuid, text, text, text, text, text, text, date, numeric, text) TO authenticated;
