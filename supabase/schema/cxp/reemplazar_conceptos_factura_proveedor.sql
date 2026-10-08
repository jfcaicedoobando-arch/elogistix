-- v13.628.0 — Edición de conceptos en facturas de proveedor capturadas a mano.
-- v13.646.0 (BUG-02, auditoría 2026-08-18): recalcula la cabecera (subtotal,
-- IVA, retenciones, total) a partir de los conceptos reemplazados.
-- v13.823.303: la cabecera se calcula SÓLO con el desglose fiscal del proveedor;
-- los renglones de vínculo (concepto_costo_id NOT NULL) duplicaban el total.
-- Espejo canónico; actualizar en el mismo PR que la migración.

CREATE OR REPLACE FUNCTION public.reemplazar_conceptos_factura_proveedor(
  p_factura_id uuid,
  p_conceptos jsonb,
  p_impuestos_no_desglosados jsonb DEFAULT NULL::jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL::timestamptz
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
  v_fiscales int := 0;
  v_iva_global numeric;
  v_ieps_global numeric;
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

  IF p_expected_updated_at IS NULL OR v_f.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'LC_CONFLICTO_CONCURRENCIA: los conceptos o la factura cambiaron mientras los editabas. Recarga antes de volver a guardar.'
      USING ERRCODE = 'PT409';
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

  -- La captura histórica admite impuestos globales sin distribución por partida.
  -- No convertir un cambio de descripción en una reducción de la deuda.
  -- El parámetro explícito permite distribuirlos o corregirlos conscientemente.
  SELECT ROUND(COALESCE(v_f.iva, 0) - COALESCE(SUM(iva), 0), 2),
         ROUND(COALESCE(v_f.ieps, 0) - COALESCE(SUM(ieps), 0), 2)
    INTO v_iva_global, v_ieps_global
    FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NULL;

  IF p_impuestos_no_desglosados IS NOT NULL THEN
    IF jsonb_typeof(p_impuestos_no_desglosados) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_impuestos_no_desglosados->'iva') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_impuestos_no_desglosados->'ieps') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'LC_CONCEPTOS_IMPUESTOS: indica IVA e IEPS globales como importes numéricos'
        USING ERRCODE = '22023';
    END IF;
    v_iva_global := ROUND((p_impuestos_no_desglosados->>'iva')::numeric, 2);
    v_ieps_global := ROUND((p_impuestos_no_desglosados->>'ieps')::numeric, 2);
    IF v_iva_global < 0 OR v_ieps_global < 0 THEN
      RAISE EXCEPTION 'LC_CONCEPTOS_IMPUESTOS: los impuestos globales no pueden ser negativos'
        USING ERRCODE = '22023';
    END IF;
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
  -- v13.823.191: el importe es UNITARIO, así que el subtotal es Σ monto × cantidad.
  -- v13.823.303: sólo el desglose fiscal del proveedor (concepto_costo_id IS NULL);
  -- los renglones de vínculo con conceptos_costo NO son cargos y duplicaban el total.
  -- Alineado con `_cxp_validar_aprobacion`, que ya suma sólo el desglose fiscal.
  SELECT COUNT(*) INTO v_fiscales
    FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id
     AND concepto_costo_id IS NULL;

  SELECT COALESCE(SUM(monto * COALESCE(NULLIF(cantidad, 0), 1)), 0),
         COALESCE(SUM(iva) FILTER (WHERE concepto_costo_id IS NULL), 0) + v_iva_global,
         COALESCE(SUM(ieps) FILTER (WHERE concepto_costo_id IS NULL), 0) + v_ieps_global
    INTO v_subtotal, v_iva, v_ieps
    FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id
     AND (v_fiscales = 0 OR concepto_costo_id IS NULL);

  IF v_iva < 0 OR v_ieps < 0 THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_IMPUESTOS: el desglose produciría impuestos negativos; revisa los importes globales'
      USING ERRCODE = '22023';
  END IF;

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

REVOKE ALL ON FUNCTION public.reemplazar_conceptos_factura_proveedor(uuid, jsonb, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reemplazar_conceptos_factura_proveedor(uuid, jsonb, jsonb, timestamptz) TO authenticated, service_role;
