-- Fuente canónica de public._cxp_desvincular_por_rechazo(uuid, text) (Ola 6 · O6-SCHEMA).
-- 1:1 con supabase/migrations/20260819090100_ola6_rg53_rg54_buzon_cxp_sin_limbo.sql.
-- Ola 6 · RG5-3: el entrante rechazado suelta proveedor_factura_id.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

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
