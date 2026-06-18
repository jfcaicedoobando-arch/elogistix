CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb;
  v_puede boolean := true;
  v_ok boolean;
  v_cxc_total numeric;
  v_cxc_pagado numeric;
  v_cxp_total numeric;
  v_cxp_pagado numeric;
  v_docs_faltantes int;
  v_pnl jsonb;
  v_utilidad numeric;
  v_margen_min numeric;
  v_com_count int;
  v_cont_incompletos int := 0;
  v_cont_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  SELECT COALESCE(sum(total),0) INTO v_cxc_total
  FROM facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  SELECT COALESCE(sum(pf.monto),0) INTO v_cxc_pagado
  FROM pagos_factura pf
  JOIN facturas f ON f.id = pf.factura_id
  WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL AND f.estado <> 'Cancelada';
  v_ok := (v_cxc_total <= v_cxc_pagado + 0.01);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxc_total, 'pagado', v_cxc_pagado)
  ));

  SELECT COALESCE(sum(total),0) INTO v_cxp_total
  FROM proveedor_facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  SELECT COALESCE(sum(pp.monto),0) INTO v_cxp_pagado
  FROM pagos_proveedor pp
  JOIN proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
  WHERE pf.embarque_id = p_embarque_id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada';
  v_ok := (v_cxp_total <= v_cxp_pagado + 0.01);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_pagada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxp_total, 'pagado', v_cxp_pagado)
  ));

  SELECT COUNT(*) INTO v_docs_faltantes
  FROM documentos_embarque de
  WHERE de.embarque_id = p_embarque_id
    AND de.requerido = true
    AND (de.archivo_url IS NULL OR de.archivo_url = '');
  v_ok := (v_docs_faltantes = 0);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','docs_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', v_docs_faltantes)
  ));

  BEGIN
    v_pnl := pnl_financiero_embarque(p_embarque_id);
  EXCEPTION WHEN OTHERS THEN
    v_pnl := '{}'::jsonb;
  END;
  v_utilidad := COALESCE((v_pnl->>'utilidad_mxn')::numeric, (v_pnl->>'utilidad')::numeric, 0);
  SELECT COALESCE((valor)::text::numeric, 0) INTO v_margen_min
  FROM configuracion_global WHERE categoria='cierre' AND clave='cierre_margen_minimo';
  v_ok := (v_utilidad >= COALESCE(v_margen_min, 0));
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','pnl_margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object('utilidad', v_utilidad, 'minimo', v_margen_min)
  ));

  SELECT count(*) INTO v_com_count
  FROM comisiones_devengadas cd
  WHERE cd.embarque_id = p_embarque_id;
  v_ok := true;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comision_calculada','ok',v_ok,
    'detalle', jsonb_build_object('comisiones_registradas', v_com_count)
  ));

  -- Nueva regla: contenedores FCL marítimos con peso/volumen capturados.
  IF v_emb.modo = 'Marítimo' AND v_emb.tipo_servicio = 'FCL' THEN
    SELECT COUNT(*), COALESCE(array_agg(ec.id), ARRAY[]::uuid[])
      INTO v_cont_incompletos, v_cont_ids
    FROM embarque_contenedores ec
    WHERE ec.embarque_id = p_embarque_id
      AND (COALESCE(ec.peso_kg, 0) <= 0 OR COALESCE(ec.volumen_m3, 0) <= 0);
    v_ok := (v_cont_incompletos = 0);
  ELSE
    v_ok := true;
    v_cont_incompletos := 0;
    v_cont_ids := ARRAY[]::uuid[];
  END IF;
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','contenedores_datos_completos','ok',v_ok,
    'detalle', jsonb_build_object('contenedores_incompletos', v_cont_incompletos, 'ids', to_jsonb(v_cont_ids))
  ));

  RETURN jsonb_build_object(
    'puede_cerrar', v_puede,
    'estatus_actual', v_emb.estado::text,
    'cerrado', (v_emb.estado::text = 'Cerrado'),
    'checks', v_checks
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated;