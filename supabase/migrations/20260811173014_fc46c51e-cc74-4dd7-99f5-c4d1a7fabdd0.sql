-- v13.508.0 — Pulido final del buzón CxP.

-- 1) Una sugerencia por documento+concepto (evita duplicados en reintentos).
DELETE FROM public.embarque_facturas_entrantes_conceptos c
 USING public.embarque_facturas_entrantes_conceptos d
 WHERE c.entrante_id = d.entrante_id
   AND c.concepto_costo_id = d.concepto_costo_id
   AND c.id > d.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_efec_entrante_concepto
  ON public.embarque_facturas_entrantes_conceptos (entrante_id, concepto_costo_id);

-- 2) Corregir datos declarados mientras el documento siga por capturar.
CREATE OR REPLACE FUNCTION public.actualizar_datos_entrante(
  p_documento_id uuid,
  p_proveedor_id uuid,
  p_monto_declarado numeric,
  p_moneda_declarada text,
  p_nota text,
  p_sin_costo_capturado boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_doc public.embarque_facturas_entrantes%ROWTYPE;
  v_filas int;
BEGIN
  SELECT * INTO v_doc FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_NOT_FOUND: documento no encontrado'; END IF;

  IF v_doc.organization_id <> v_caller_org AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: documento de otra organización';
  END IF;

  IF p_proveedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.proveedores p
     WHERE p.id = p_proveedor_id AND p.organization_id = v_doc.organization_id
  ) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: proveedor de otra organización';
  END IF;

  UPDATE public.embarque_facturas_entrantes
     SET proveedor_id = COALESCE(p_proveedor_id, proveedor_id),
         monto_declarado = p_monto_declarado,
         moneda_declarada = CASE
           WHEN p_monto_declarado IS NULL THEN NULL
           ELSE COALESCE(NULLIF(btrim(p_moneda_declarada), ''), 'MXN')
         END,
         nota = NULLIF(btrim(COALESCE(p_nota, '')), ''),
         sin_costo_capturado = COALESCE(p_sin_costo_capturado, false)
   WHERE id = p_documento_id
     AND deleted_at IS NULL
     AND estado = 'por_capturar';

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas = 0 THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: sólo se pueden corregir documentos por capturar';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_datos_entrante(uuid, uuid, numeric, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_datos_entrante(uuid, uuid, numeric, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.actualizar_datos_entrante(uuid, uuid, numeric, text, text, boolean) TO authenticated;

-- 3) Reemplazo atómico de los conceptos sugeridos del documento.
CREATE OR REPLACE FUNCTION public.reemplazar_conceptos_entrante(
  p_documento_id uuid,
  p_conceptos jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_doc public.embarque_facturas_entrantes%ROWTYPE;
  v_insertados int := 0;
BEGIN
  SELECT * INTO v_doc FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_NOT_FOUND: documento no encontrado'; END IF;

  IF v_doc.organization_id <> v_caller_org AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: documento de otra organización';
  END IF;

  IF v_doc.estado <> 'por_capturar' THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: sólo se pueden corregir documentos por capturar';
  END IF;

  DELETE FROM public.embarque_facturas_entrantes_conceptos WHERE entrante_id = p_documento_id;

  INSERT INTO public.embarque_facturas_entrantes_conceptos
    (entrante_id, concepto_costo_id, organization_id, monto_sugerido)
  SELECT p_documento_id,
         (x->>'conceptoId')::uuid,
         v_doc.organization_id,
         NULLIF(x->>'monto', '')::numeric
    FROM jsonb_array_elements(COALESCE(p_conceptos, '[]'::jsonb)) AS x
   WHERE EXISTS (
     SELECT 1 FROM public.conceptos_costo cc
      WHERE cc.id = (x->>'conceptoId')::uuid
        AND cc.embarque_id = v_doc.embarque_id
        AND cc.organization_id = v_doc.organization_id
   )
  ON CONFLICT (entrante_id, concepto_costo_id) DO NOTHING;

  GET DIAGNOSTICS v_insertados = ROW_COUNT;
  RETURN v_insertados;
END;
$$;

REVOKE ALL ON FUNCTION public.reemplazar_conceptos_entrante(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reemplazar_conceptos_entrante(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.reemplazar_conceptos_entrante(uuid, jsonb) TO authenticated;

-- 4) Al rechazar, avisar a quien subió el documento.
CREATE OR REPLACE FUNCTION public.rechazar_factura_entrante(
  p_documento_id uuid,
  p_motivo text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_doc public.embarque_facturas_entrantes%ROWTYPE;
  v_expediente text;
  v_filas int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin permiso para rechazar facturas entrantes';
  END IF;

  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'LC_MOTIVO_REQUERIDO: indica el motivo del rechazo';
  END IF;

  SELECT * INTO v_doc FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_NOT_FOUND: documento no encontrado'; END IF;

  IF v_doc.organization_id <> v_caller_org AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: documento de otra organización';
  END IF;

  UPDATE public.embarque_facturas_entrantes
     SET estado = 'rechazada',
         rechazo_motivo = btrim(p_motivo),
         capturado_por = auth.uid()
   WHERE id = p_documento_id
     AND deleted_at IS NULL
     AND estado = 'por_capturar';

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  IF v_filas = 0 THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento ya fue procesado';
  END IF;

  SELECT e.expediente INTO v_expediente FROM public.embarques e WHERE e.id = v_doc.embarque_id;

  IF v_doc.subido_por IS NOT NULL AND v_doc.subido_por <> auth.uid() THEN
    INSERT INTO public.notificaciones_internas
      (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
    VALUES (
      v_doc.organization_id,
      v_doc.subido_por,
      'cxp_entrante_rechazada',
      'Contabilidad rechazó una factura del buzón',
      COALESCE(v_expediente, 'Embarque') || ': ' || COALESCE(v_doc.nombre_archivo, 'documento')
        || ' — ' || btrim(p_motivo),
      '/embarques/' || v_doc.embarque_id::text,
      'embarque_factura_entrante',
      v_doc.id
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rechazar_factura_entrante(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rechazar_factura_entrante(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rechazar_factura_entrante(uuid, text) TO authenticated;