-- =====================================================================
-- Ola 6 · RG5-3 / RG5-4: buzón CxP.
--
-- RG5-3: al rechazar la factura, el entrante quedaba 'rechazada' PERO
-- conservando proveedor_factura_id, y tanto retirar_ como reactivar_
-- abortan cuando ese campo no es NULL ⇒ documento en limbo. Se limpia el
-- vínculo en el mismo UPDATE del rechazo.
--
-- RG5-4: retirar_/reactivar_ validaban estado con un SELECT previo y
-- después hacían el UPDATE sin re-verificar ⇒ una captura concurrente
-- podía colarse entre ambos. Ahora la condición viaja DENTRO del UPDATE y
-- se decide con ROW_COUNT.
-- =====================================================================

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

  -- Ola 6 · RG5-3: el archivo entrante queda rechazado Y SIN VÍNCULO a la
  -- factura cancelada, para que pueda retirarse o reactivarse después.
  UPDATE public.embarque_facturas_entrantes
     SET estado = 'rechazada',
         rechazo_motivo = COALESCE(NULLIF(btrim(p_motivo), ''), 'Factura rechazada'),
         proveedor_factura_id = NULL,
         capturado_por = NULL,
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
GRANT EXECUTE ON FUNCTION public._cxp_desvincular_por_rechazo(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.retirar_factura_entrante(p_documento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_es_admin boolean := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin');
  v_doc public.embarque_facturas_entrantes%ROWTYPE;
  v_filas int := 0;
BEGIN
  IF NOT (v_es_admin
          OR public.has_role(auth.uid(), 'operador')
          OR public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')) THEN
    RAISE EXCEPTION 'LC_ENTRANTE_RETIRO_FORBIDDEN: sin permiso para retirar documentos del buzón';
  END IF;

  SELECT * INTO v_doc FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_NOT_FOUND: documento no encontrado'; END IF;

  IF v_doc.organization_id IS DISTINCT FROM v_caller_org AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: documento de otra organización';
  END IF;

  IF NOT v_es_admin AND v_doc.subido_por IS DISTINCT FROM auth.uid()
     AND v_doc.estado = 'por_capturar' THEN
    RAISE EXCEPTION 'LC_ENTRANTE_RETIRO_FORBIDDEN: sólo quien subió el archivo o un administrador puede retirarlo';
  END IF;

  -- Ola 6 · RG5-4: la validación de estado/vínculo viaja DENTRO del UPDATE
  -- para que una captura concurrente no se cuele entre el SELECT y el
  -- UPDATE (antes: check-then-act).
  UPDATE public.embarque_facturas_entrantes
     SET deleted_at = now()
   WHERE id = p_documento_id
     AND deleted_at IS NULL
     AND estado IN ('por_capturar', 'rechazada')
     AND proveedor_factura_id IS NULL;
  GET DIAGNOSTICS v_filas = ROW_COUNT;

  IF v_filas = 0 THEN
    RAISE EXCEPTION 'LC_ENTRANTE_RETIRO_CAPTURADA: el documento ya fue capturado como factura de proveedor';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reactivar_factura_entrante(p_documento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_doc public.embarque_facturas_entrantes%ROWTYPE;
  v_filas int := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'operador')
          OR public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'LC_ENTRANTE_REACTIVAR_FORBIDDEN: sin permiso para devolver documentos al buzón';
  END IF;

  SELECT * INTO v_doc FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_NOT_FOUND: documento no encontrado'; END IF;

  IF v_doc.organization_id IS DISTINCT FROM v_caller_org AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: documento de otra organización';
  END IF;

  -- Ola 6 · RG5-4: condición dentro del UPDATE (ver retirar_factura_entrante).
  UPDATE public.embarque_facturas_entrantes
     SET estado = 'por_capturar',
         rechazo_motivo = NULL,
         capturado_por = NULL
   WHERE id = p_documento_id
     AND deleted_at IS NULL
     AND estado = 'rechazada'
     AND proveedor_factura_id IS NULL;
  GET DIAGNOSTICS v_filas = ROW_COUNT;

  IF v_filas = 0 THEN
    RAISE EXCEPTION 'LC_ENTRANTE_REACTIVAR_ESTADO: sólo un documento rechazado y sin factura vinculada puede volver a por capturar';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.retirar_factura_entrante(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivar_factura_entrante(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_factura_entrante(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reactivar_factura_entrante(uuid) TO authenticated, service_role;