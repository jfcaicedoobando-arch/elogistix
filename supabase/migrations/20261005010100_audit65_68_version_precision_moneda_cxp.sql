-- Hallazgos 65–68: precisión por campo, decisión/reemplazo CAS y moneda estable con aplicaciones.
-- Sin backfill ni cambios en pagos, notas de crédito o anticipos históricos.
DROP FUNCTION IF EXISTS public.aprobar_factura_proveedor(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.reemplazar_conceptos_factura_proveedor(uuid, jsonb, jsonb);
CREATE OR REPLACE FUNCTION public.aprobar_factura_proveedor(p_id uuid, p_aprobar boolean, p_motivo text DEFAULT NULL::text, p_expected_updated_at timestamptz DEFAULT NULL::timestamptz) RETURNS public.proveedor_facturas
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.proveedor_facturas;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_es_admin boolean;
  v_desvinculo jsonb := '{}'::jsonb;
  v_estado_actual text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador'])
  ) INTO v_autorizado;
  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: Tu rol no puede aprobar ni rechazar facturas de proveedor.';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin'])
  ) INTO v_es_admin;
  -- A-3: FOR UPDATE serializa dos clics simultáneos sobre la misma factura.
  SELECT * INTO v_row FROM public.proveedor_facturas
   WHERE id = p_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;
  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = v_row.organization_id
          AND om.user_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = '42501';
  END IF;
  IF p_expected_updated_at IS NULL OR v_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'LC_CONFLICTO_CONCURRENCIA: la factura cambió desde que la revisaste. Recarga y revisa los datos actuales antes de decidir.'
      USING ERRCODE = '40001';
  END IF;
  IF v_row.estado_aprobacion <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_row.estado_aprobacion;
  END IF;
  -- SoD: quien capturó no aprueba su propia factura (salvo administradores)
  IF p_aprobar
     AND v_row.created_by IS NOT NULL
     AND v_row.created_by = v_uid
     AND NOT v_es_admin
  THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: No puedes aprobar una factura que tú mismo capturaste. Pide la aprobación a otra persona.';
  END IF;
  -- Ola 4 (H2): al aprobar, `p_motivo` es la justificación del gasto sin respaldo.
  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id, p_motivo);
  END IF;
  -- A-3: relectura redundante dentro del bloqueo (defensa ante validaciones
  -- que pudieran liberar el lock por subtransacciones).
  SELECT estado_aprobacion::text INTO v_estado_actual
    FROM public.proveedor_facturas WHERE id = p_id FOR UPDATE;
  IF v_estado_actual <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_estado_actual;
  END IF;
  -- RNF-07: marca de sesión requerida por trg_guard_aprobacion_proveedor_factura
  PERFORM set_config('app.aprobando_cxp', '1', true);
  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada',
        aprobada_por = v_uid,
        aprobada_at = now(),
        motivo_rechazo = NULL,
        aprobacion_heredada = false,
        justificacion_sin_vinculo = NULLIF(btrim(COALESCE(p_motivo,'')), '')
    WHERE id = p_id AND estado_aprobacion = 'pendiente' RETURNING * INTO v_row;
  ELSE
    IF COALESCE(trim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo de rechazo requerido';
    END IF;
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'rechazada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = p_motivo
    WHERE id = p_id AND estado_aprobacion = 'pendiente' RETURNING * INTO v_row;
  END IF;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'La factura ya fue procesada por otra sesión. Recarga la pantalla.'
      USING ERRCODE = 'serialization_failure';
  END IF;
  IF NOT p_aprobar THEN
    -- v13.493.0 — el rechazo rompe el vínculo con el embarque.
    v_desvinculo := public._cxp_desvincular_por_rechazo(p_id, p_motivo);
    SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id;
  END IF;
  PERFORM set_config('app.aprobando_cxp', '0', true);
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (
      v_row.organization_id,
      v_uid,
      COALESCE(v_email, ''),
      CASE WHEN p_aprobar THEN 'aprobar_factura_proveedor' ELSE 'rechazar_factura_proveedor' END,
      'cxp',
      v_row.id,
      'Factura ' || COALESCE(v_row.folio_proveedor,'') || ' de ' || COALESCE(v_row.proveedor_nombre,''),
      jsonb_build_object(
        'motivo', p_motivo,
        'total', v_row.total,
        'aprobada', p_aprobar,
        'justificacion_sin_vinculo', v_row.justificacion_sin_vinculo
      ) || v_desvinculo
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora_actividad insert failed in aprobar_factura_proveedor: % %', SQLSTATE, SQLERRM;
  END;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text, timestamptz) TO authenticated, service_role;

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
      USING ERRCODE = '40001';
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

-- Auditoría 65–68. No modifica documentos históricos: protege nuevas ediciones.
CREATE OR REPLACE FUNCTION public.guard_edicion_factura_proveedor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- La moneda es la unidad de las aplicaciones históricas. Para corregirla se
  -- requiere el flujo explícito de reverso; editar la cabecera no reconvierte pagos.
  IF NEW.moneda IS DISTINCT FROM OLD.moneda AND (
    EXISTS (SELECT 1 FROM public.pagos_proveedor pp
             WHERE pp.proveedor_factura_id = OLD.id AND pp.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.proveedor_notas_credito nc
                WHERE nc.proveedor_factura_id = OLD.id AND nc.estado = 'Aplicada' AND nc.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                WHERE aa.proveedor_factura_id = OLD.id AND aa.deleted_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'LC_CXP_MONEDA_CON_APLICACIONES: la moneda no puede cambiar mientras existan pagos, notas de crédito o anticipos aplicados. Usa el flujo autorizado de reverso antes de corregir la moneda.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.estado_aprobacion = 'aprobada' AND (
    NEW.folio_proveedor IS DISTINCT FROM OLD.folio_proveedor
    OR NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision
    OR NEW.moneda IS DISTINCT FROM OLD.moneda
    OR ROUND(NEW.tipo_cambio_usd, 4) IS DISTINCT FROM ROUND(OLD.tipo_cambio_usd, 4)
    OR ROUND(NEW.subtotal, 2) IS DISTINCT FROM ROUND(OLD.subtotal, 2)
    OR ROUND(NEW.iva, 2) IS DISTINCT FROM ROUND(OLD.iva, 2)
    OR ROUND(NEW.ieps, 2) IS DISTINCT FROM ROUND(OLD.ieps, 2)
    OR ROUND(NEW.retenciones, 2) IS DISTINCT FROM ROUND(OLD.retenciones, 2)
  ) THEN
    NEW.estado_aprobacion := 'pendiente';
    NEW.aprobada_por := NULL;
    NEW.aprobada_at := NULL;
    NEW.aprobacion_heredada := false;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_edicion_factura_proveedor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_edicion_factura_proveedor() TO service_role;

CREATE OR REPLACE FUNCTION public._versionar_factura_proveedor() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- now() es constante dentro de la transacción. Ni dos escrituras consecutivas
  -- ni un timestamp enviado por el cliente pueden reutilizar una versión.
  NEW.updated_at := GREATEST(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._versionar_factura_proveedor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._versionar_factura_proveedor() TO service_role;

CREATE OR REPLACE FUNCTION public._versionar_conceptos_factura_proveedor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_ids uuid[];
BEGIN
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'updated_at') = (to_jsonb(OLD) - 'updated_at') THEN
    RETURN NEW;
  END IF;
  v_ids := CASE TG_OP
    WHEN 'INSERT' THEN ARRAY[NEW.proveedor_factura_id]
    WHEN 'DELETE' THEN ARRAY[OLD.proveedor_factura_id]
    ELSE ARRAY[OLD.proveedor_factura_id, NEW.proveedor_factura_id] END;
  -- El bloqueo del padre precede a la escritura del concepto: la aprobación
  -- y el reemplazo transaccional serializan también contra escrituras directas.
  FOR v_id IN SELECT DISTINCT unnest(v_ids) ORDER BY 1 LOOP
    UPDATE public.proveedor_facturas
       SET updated_at = clock_timestamp(),
           estado_aprobacion = CASE WHEN estado_aprobacion = 'aprobada' THEN 'pendiente'::public.estado_aprobacion_factura_proveedor ELSE estado_aprobacion END,
           aprobada_por = CASE WHEN estado_aprobacion = 'aprobada' THEN NULL ELSE aprobada_por END,
           aprobada_at = CASE WHEN estado_aprobacion = 'aprobada' THEN NULL ELSE aprobada_at END,
           aprobacion_heredada = false
     WHERE id = v_id;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._versionar_conceptos_factura_proveedor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._versionar_conceptos_factura_proveedor() TO service_role;

DROP TRIGGER IF EXISTS trg_cxp_edicion_sensible ON public.proveedor_facturas;
CREATE TRIGGER trg_cxp_edicion_sensible BEFORE UPDATE ON public.proveedor_facturas
FOR EACH ROW EXECUTE FUNCTION public.guard_edicion_factura_proveedor();

DROP TRIGGER IF EXISTS trg_proveedor_facturas_updated ON public.proveedor_facturas;
CREATE TRIGGER trg_proveedor_facturas_updated BEFORE UPDATE ON public.proveedor_facturas
FOR EACH ROW EXECUTE FUNCTION public._versionar_factura_proveedor();

DROP TRIGGER IF EXISTS trg_cxp_versionar_conceptos ON public.proveedor_facturas_conceptos;
CREATE TRIGGER trg_cxp_versionar_conceptos BEFORE INSERT OR UPDATE OR DELETE ON public.proveedor_facturas_conceptos
FOR EACH ROW EXECUTE FUNCTION public._versionar_conceptos_factura_proveedor();
