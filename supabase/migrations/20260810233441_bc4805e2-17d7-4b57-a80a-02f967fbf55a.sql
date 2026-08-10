-- Rechazo de factura de proveedor: libera embarque, conceptos y archivo entrante.
CREATE OR REPLACE FUNCTION public._cxp_desvincular_por_rechazo(p_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.proveedor_facturas;
  v_pagado numeric;
  v_vinculos int := 0;
  v_ajustes int := 0;
  v_entrantes int := 0;
BEGIN
  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
  FROM public.pagos_proveedor
  WHERE proveedor_factura_id = p_id AND deleted_at IS NULL;

  IF v_pagado > 0 OR v_row.estado = 'Pagada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_CXP_RECHAZO_CON_PAGOS: la factura tiene pagos aplicados; anúlalos antes de rechazarla.'
      USING ERRCODE = '22023';
  END IF;

  -- Cancelar la factura: dispara la reversión de conceptos de ajuste
  -- (tg_reverse_ajustes_factura_proveedor) dentro de la misma transacción.
  IF v_row.estado <> 'Cancelada'::public.estado_proveedor_factura THEN
    PERFORM set_config('app.cancelando_cxp', '1', true);
    UPDATE public.proveedor_facturas
       SET estado = 'Cancelada'::public.estado_proveedor_factura,
           fecha_cancelacion = now(),
           motivo_cancelacion = COALESCE(NULLIF(btrim(p_motivo), ''), 'Factura rechazada'),
           cancelada_por = auth.uid(),
           updated_at = now()
     WHERE id = p_id;
    PERFORM set_config('app.cancelando_cxp', '0', true);
  END IF;

  SELECT count(*) INTO v_ajustes
  FROM public.conceptos_costo cc
  JOIN public.proveedor_facturas_conceptos pfc ON pfc.concepto_costo_id = cc.id
  WHERE pfc.proveedor_factura_id = p_id
    AND cc.origen = 'ajuste_factura_proveedor'
    AND cc.deleted_at IS NOT NULL;

  -- Romper el vínculo con los conceptos de costo: vuelven a "pendiente de factura".
  DELETE FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id = p_id;
  GET DIAGNOSTICS v_vinculos = ROW_COUNT;

  -- Soltar el embarque.
  UPDATE public.proveedor_facturas SET embarque_id = NULL, updated_at = now() WHERE id = p_id;

  -- El archivo entrante queda rechazado (no vuelve a pedir captura).
  UPDATE public.embarque_facturas_entrantes
     SET estado = 'rechazada',
         rechazo_motivo = COALESCE(NULLIF(btrim(p_motivo), ''), 'Factura rechazada'),
         updated_at = now()
   WHERE proveedor_factura_id = p_id
     AND deleted_at IS NULL;
  GET DIAGNOSTICS v_entrantes = ROW_COUNT;

  RETURN jsonb_build_object(
    'vinculos_eliminados', v_vinculos,
    'ajustes_revertidos', v_ajustes,
    'entrantes_rechazados', v_entrantes,
    'embarque_liberado', v_row.embarque_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public._cxp_desvincular_por_rechazo(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cxp_desvincular_por_rechazo(uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.aprobar_factura_proveedor(p_id uuid, p_aprobar boolean, p_motivo text DEFAULT NULL::text)
RETURNS public.proveedor_facturas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.proveedor_facturas;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_es_admin boolean;
  v_desvinculo jsonb := '{}'::jsonb;
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

  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id AND deleted_at IS NULL;
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

  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id);
  END IF;

  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = NULL
    WHERE id = p_id RETURNING * INTO v_row;
  ELSE
    IF COALESCE(trim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo de rechazo requerido';
    END IF;
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'rechazada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = p_motivo
    WHERE id = p_id RETURNING * INTO v_row;

    -- v13.493.0 — el rechazo rompe el vínculo con el embarque: los conceptos de
    -- costo vuelven a quedar pendientes de factura y la factura se cancela.
    v_desvinculo := public._cxp_desvincular_por_rechazo(p_id, p_motivo);
    SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id;
  END IF;

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
      jsonb_build_object('motivo', p_motivo, 'total', v_row.total, 'aprobada', p_aprobar)
        || v_desvinculo
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora_actividad insert failed in aprobar_factura_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) TO authenticated;