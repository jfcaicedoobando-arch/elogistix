CREATE OR REPLACE FUNCTION public._cxp_desvincular_por_rechazo(p_id uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_pagado numeric;
  v_vinculos int := 0;
  v_ajustes int := 0;
  v_entrantes int := 0;
  v_ids uuid[];
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

  -- Guardamos los documentos del buzón ANTES de cancelar: el trigger
  -- trg_reabrir_entrantes_factura los devuelve a "por_capturar" y borra el
  -- vínculo, así que después ya no podríamos encontrarlos por factura.
  SELECT array_agg(id) INTO v_ids
  FROM public.embarque_facturas_entrantes
  WHERE proveedor_factura_id = p_id AND deleted_at IS NULL;

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

  DELETE FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id = p_id;
  GET DIAGNOSTICS v_vinculos = ROW_COUNT;

  UPDATE public.proveedor_facturas SET embarque_id = NULL, updated_at = now() WHERE id = p_id;

  UPDATE public.embarque_facturas_entrantes
     SET estado = 'rechazada',
         rechazo_motivo = COALESCE(NULLIF(btrim(p_motivo), ''), 'Factura rechazada'),
         proveedor_factura_id = NULL,
         capturado_por = NULL,
         updated_at = now()
   WHERE deleted_at IS NULL
     AND (proveedor_factura_id = p_id
          OR (v_ids IS NOT NULL AND id = ANY(v_ids)));
  GET DIAGNOSTICS v_entrantes = ROW_COUNT;

  RETURN jsonb_build_object(
    'vinculos_eliminados', v_vinculos,
    'ajustes_revertidos', v_ajustes,
    'entrantes_rechazados', v_entrantes,
    'embarque_liberado', v_row.embarque_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._cxp_desvincular_por_rechazo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._cxp_desvincular_por_rechazo(uuid, text) TO authenticated, service_role;