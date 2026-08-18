-- v13.628.0 — Edición de conceptos en facturas de proveedor capturadas a mano.
-- v13.646.0 (BUG-02, auditoría 2026-08-18): recalcula la cabecera (subtotal,
-- IVA, retenciones, total) a partir de los conceptos reemplazados.
-- Espejo canónico; actualizar en el mismo PR que la migración.

CREATE OR REPLACE FUNCTION public.reemplazar_conceptos_factura_proveedor(
  p_factura_id uuid,
  p_conceptos jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_f public.proveedor_facturas%ROWTYPE;
  v_pagado numeric := 0;
  v_insertados int := 0;
  v_subtotal numeric := 0;
  v_iva numeric := 0;
  v_ieps numeric := 0;
BEGIN
  SELECT * INTO v_f FROM public.proveedor_facturas
   WHERE id = p_factura_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_NOT_FOUND: la factura no existe' USING ERRCODE = 'P0002';
  END IF;
  IF v_f.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_ELIMINADA: la factura está en la papelera' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_org_member(v_f.organization_id)
     AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: factura de otra organización' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')
          OR public.has_role(auth.uid(), 'admin_org')
          OR public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')
          OR public.has_role(auth.uid(), 'tesorero')) THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_FORBIDDEN: sin permiso para editar los conceptos de la factura'
      USING ERRCODE = '42501';
  END IF;

  IF v_f.uuid_fiscal IS NOT NULL OR v_f.archivo_xml_url IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_FISCALES: los conceptos vienen del XML del CFDI; vuelve a adjuntar el XML para cambiarlos'
      USING ERRCODE = '22023';
  END IF;

  IF v_f.estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_FACTURA_CANCELADA: la factura está cancelada' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
    FROM public.pagos_proveedor
   WHERE proveedor_factura_id = p_factura_id AND deleted_at IS NULL;
  IF v_pagado > 0 THEN
    RAISE EXCEPTION 'LC_FACTURA_CON_PAGOS: la factura tiene pagos aplicados por %; elimina los pagos antes de editar los conceptos', v_pagado
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id
     AND concepto_costo_id IS NULL;

  INSERT INTO public.proveedor_facturas_conceptos
    (proveedor_factura_id, organization_id, concepto_costo_id,
     descripcion, cantidad, clave_unidad, monto, iva, ieps)
  SELECT p_factura_id,
         v_f.organization_id,
         NULL,
         COALESCE(NULLIF(btrim(x->>'descripcion'), ''), '(Sin descripción)'),
         COALESCE(NULLIF(x->>'cantidad', '')::numeric, 1),
         NULLIF(btrim(COALESCE(x->>'clave_unidad', '')), ''),
         COALESCE(NULLIF(x->>'monto', '')::numeric, 0),
         COALESCE(NULLIF(x->>'iva', '')::numeric, 0),
         COALESCE(NULLIF(x->>'ieps', '')::numeric, 0)
    FROM jsonb_array_elements(COALESCE(p_conceptos, '[]'::jsonb)) AS x;
  GET DIAGNOSTICS v_insertados = ROW_COUNT;

  -- BUG-02 (auditoría 2026-08-18): la cabecera debe cuadrar con sus renglones.
  -- `guard_proveedor_factura_total` recalcula `total` a partir de estos campos.
  SELECT COALESCE(SUM(monto), 0), COALESCE(SUM(iva), 0), COALESCE(SUM(ieps), 0)
    INTO v_subtotal, v_iva, v_ieps
    FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id;

  UPDATE public.proveedor_facturas
     SET subtotal = ROUND(v_subtotal, 2),
         iva      = ROUND(v_iva, 2),
         ieps     = ROUND(v_ieps, 2),
         estado_aprobacion = CASE
           WHEN estado_aprobacion = 'aprobada'::public.estado_aprobacion_factura_proveedor
             THEN 'pendiente'::public.estado_aprobacion_factura_proveedor
           ELSE estado_aprobacion END,
         aprobada_por = CASE
           WHEN estado_aprobacion = 'aprobada'::public.estado_aprobacion_factura_proveedor
             THEN NULL ELSE aprobada_por END,
         aprobada_at = CASE
           WHEN estado_aprobacion = 'aprobada'::public.estado_aprobacion_factura_proveedor
             THEN NULL ELSE aprobada_at END,
         updated_at = now()
   WHERE id = p_factura_id;

  RETURN v_insertados;
END;
$$;

REVOKE ALL ON FUNCTION public.reemplazar_conceptos_factura_proveedor(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reemplazar_conceptos_factura_proveedor(uuid, jsonb) TO authenticated, service_role;
