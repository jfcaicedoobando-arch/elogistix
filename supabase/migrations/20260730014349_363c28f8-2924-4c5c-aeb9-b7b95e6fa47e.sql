-- =====================================================================
-- Buzón de facturas de proveedor entrantes (operación -> contabilidad)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.embarque_facturas_entrantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL,
  nota text,
  archivo_path text NOT NULL,
  archivo_hash text NOT NULL,
  nombre_archivo text NOT NULL,
  estado text NOT NULL DEFAULT 'por_capturar'
    CHECK (estado IN ('por_capturar','capturada','rechazada')),
  ia_estado text NOT NULL DEFAULT 'pendiente'
    CHECK (ia_estado IN ('pendiente','ok','error')),
  ia_payload jsonb,
  folio_detectado text,
  total_detectado numeric(18,2),
  moneda_detectada text,
  proveedor_factura_id uuid REFERENCES public.proveedor_facturas(id) ON DELETE SET NULL,
  rechazo_motivo text,
  subido_por uuid,
  capturado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.embarque_facturas_entrantes TO authenticated;
GRANT ALL ON public.embarque_facturas_entrantes TO service_role;

ALTER TABLE public.embarque_facturas_entrantes ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_efe_org_hash_vivo
  ON public.embarque_facturas_entrantes (organization_id, archivo_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_efe_embarque
  ON public.embarque_facturas_entrantes (embarque_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_efe_org_estado
  ON public.embarque_facturas_entrantes (organization_id, estado) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_efe_updated_at ON public.embarque_facturas_entrantes;
CREATE TRIGGER trg_efe_updated_at
  BEFORE UPDATE ON public.embarque_facturas_entrantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------- RLS
DROP POLICY IF EXISTS "Tenant lectura facturas entrantes" ON public.embarque_facturas_entrantes;
CREATE POLICY "Tenant lectura facturas entrantes"
  ON public.embarque_facturas_entrantes FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Operaciones sube facturas entrantes" ON public.embarque_facturas_entrantes;
CREATE POLICY "Operaciones sube facturas entrantes"
  ON public.embarque_facturas_entrantes FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'))
    AND subido_por = auth.uid()
    AND estado = 'por_capturar'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'operador')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'contador')
      OR public.has_role(auth.uid(), 'auxiliar_contable')
    )
  );

DROP POLICY IF EXISTS "Autor edita facturas entrantes pendientes" ON public.embarque_facturas_entrantes;
CREATE POLICY "Autor edita facturas entrantes pendientes"
  ON public.embarque_facturas_entrantes FOR UPDATE TO authenticated
  USING (
    (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'))
    AND estado = 'por_capturar'
    AND (subido_por = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'))
    AND estado = 'por_capturar'
  );

-- ------------------------------------------------------- RPC: capturar
CREATE OR REPLACE FUNCTION public.capturar_factura_entrante(
  p_documento_id uuid,
  p_factura_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE public.proveedor_facturas
     SET archivo_pdf_url = COALESCE(archivo_pdf_url, v_doc.archivo_path)
   WHERE id = p_factura_id;
END;
$$;

REVOKE ALL ON FUNCTION public.capturar_factura_entrante(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capturar_factura_entrante(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.capturar_factura_entrante(uuid, uuid) TO authenticated;

-- ------------------------------------------------------- RPC: rechazar
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

  IF v_doc.estado <> 'por_capturar' THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento ya fue %', v_doc.estado;
  END IF;

  UPDATE public.embarque_facturas_entrantes
     SET estado = 'rechazada',
         rechazo_motivo = btrim(p_motivo),
         capturado_por = auth.uid()
   WHERE id = p_documento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rechazar_factura_entrante(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rechazar_factura_entrante(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rechazar_factura_entrante(uuid, text) TO authenticated;