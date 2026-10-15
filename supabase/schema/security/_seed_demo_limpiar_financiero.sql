CREATE OR REPLACE FUNCTION public._seed_demo_limpiar_financiero()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := 'de100000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Provisional fail-closed stop: conservation/adoption is not verified.
  -- No flag or skip window may enable destructive reseeding in this release.
  RAISE EXCEPTION 'LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción'
    USING ERRCODE = '55000';
  PERFORM set_config('app.seed_demo', '1', true);

  -- Los REPs vivos bloquean el borrado de pagos: en demo se limpian primero.
  UPDATE public.pagos_factura
     SET uuid_rep = NULL, estado_rep = NULL, rep_cancelado_en = now()
   WHERE organization_id = v_org
     AND uuid_rep IS NOT NULL;

  -- CxC y comisiones (dependen de facturas y embarques).
  DELETE FROM public.comisiones_recalculo_pendiente WHERE organization_id = v_org;
  DELETE FROM public.comisiones_excepciones WHERE organization_id = v_org;
  DELETE FROM public.comisiones_devengadas WHERE organization_id = v_org;
  DELETE FROM public.liquidaciones_comision WHERE organization_id = v_org;
  DELETE FROM public.cobranza_seguimiento WHERE organization_id = v_org;
  DELETE FROM public.factura_recordatorios WHERE organization_id = v_org;
  DELETE FROM public.factura_envios WHERE organization_id = v_org;
  DELETE FROM public.factura_notas_credito WHERE organization_id = v_org;
  DELETE FROM public.bbva_movimientos WHERE organization_id = v_org;
  DELETE FROM public.traspasos_bancarios WHERE organization_id = v_org;
  DELETE FROM public.pagos_factura WHERE organization_id = v_org;
  DELETE FROM public.pagos_factura_lote WHERE organization_id = v_org;
  DELETE FROM public.pagos_proveedor_lote WHERE organization_id = v_org;
  DELETE FROM public.refacturaciones WHERE organization_id = v_org;
  DELETE FROM public.factura_embarques WHERE organization_id = v_org;
  DELETE FROM public.conceptos_factura WHERE organization_id = v_org;
  DELETE FROM public.facturas WHERE organization_id = v_org;

  -- Proformas y conceptos de venta/costo.
  DELETE FROM public.proforma_envios WHERE organization_id = v_org;
  DELETE FROM public.proforma_conceptos_consolidados WHERE organization_id = v_org;
  DELETE FROM public.conceptos_venta WHERE organization_id = v_org;
  DELETE FROM public.conceptos_costo WHERE organization_id = v_org;
  DELETE FROM public.proformas WHERE organization_id = v_org;

  -- Operación del embarque.
  DELETE FROM public.embarque_facturas_entrantes_conceptos WHERE organization_id = v_org;
  DELETE FROM public.embarque_facturas_entrantes WHERE organization_id = v_org;
  DELETE FROM public.embarque_garantias_historial WHERE organization_id = v_org;
  DELETE FROM public.embarque_garantias_contenedor WHERE organization_id = v_org;
  DELETE FROM public.embarque_contenedores WHERE organization_id = v_org;
  DELETE FROM public.documentos_embarque WHERE organization_id = v_org;
  DELETE FROM public.notas_embarque WHERE organization_id = v_org;
  DELETE FROM public.seguros_embarque WHERE organization_id = v_org;
  DELETE FROM public.cierre_embarque_log WHERE organization_id = v_org;
  DELETE FROM public.tracking_externo WHERE organization_id = v_org;
  DELETE FROM public.tracking_links WHERE organization_id = v_org;
  DELETE FROM public.cotizacion_costos WHERE organization_id = v_org;
  DELETE FROM public.cotizacion_versiones WHERE organization_id = v_org;
  DELETE FROM public.cotizacion_envios WHERE organization_id = v_org;

  PERFORM set_config('app.seed_demo', '0', true);
END;
$function$;
REVOKE ALL ON FUNCTION public._seed_demo_limpiar_financiero() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._seed_demo_limpiar_financiero() TO service_role;
