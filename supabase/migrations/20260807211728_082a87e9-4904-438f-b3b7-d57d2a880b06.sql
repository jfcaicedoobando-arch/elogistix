CREATE OR REPLACE FUNCTION public.archivar_version_cotizacion(p_cotizacion_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_version INT; v_org UUID;
BEGIN
  SELECT version, organization_id INTO v_version, v_org FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización % no encontrada', p_cotizacion_id; END IF;
  INSERT INTO cotizacion_costos_historico (
    cotizacion_id, version, organization_id, origen_costo_id, concepto, proveedor, cantidad, unidad_medida,
    costo_unitario, costo_total, precio_venta, precio_total, profit, porcentaje_profit, moneda, notas,
    costeo_tarifa_id, costeo_tarifa_recargo_id, archivada_por, motivo)
  SELECT cc.cotizacion_id, v_version, cc.organization_id, cc.id, cc.concepto, cc.proveedor, cc.cantidad, cc.unidad_medida,
    cc.costo_unitario, cc.costo_total, cc.precio_venta, cc.precio_total, cc.profit, cc.porcentaje_profit, cc.moneda, cc.notas,
    cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id, auth.uid(), p_motivo
  FROM cotizacion_costos cc WHERE cc.cotizacion_id = p_cotizacion_id AND cc.deleted_at IS NULL;
  PERFORM public.registrar_bitacora('cotizaciones','archivar_version_costos',p_cotizacion_id,'',
    jsonb_build_object('version', v_version, 'motivo', COALESCE(p_motivo,'')), v_org, auth.uid());
  RETURN v_version;
END $function$;