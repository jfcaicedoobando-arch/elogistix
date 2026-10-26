CREATE OR REPLACE FUNCTION public.refacturar_proforma_rpc(p_proforma_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old public.proformas;
  v_new public.proformas;
  v_conceptos uuid[];
  v_factura_num text;
  v_viva boolean;
BEGIN
  SELECT * INTO v_old FROM public.proformas WHERE id = p_proforma_id FOR UPDATE;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_NO_ENCONTRADA';
  END IF;
  IF NOT public.is_org_member(v_old.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;
  IF NOT public.has_any_role_efectivo(auth.uid(),
       ARRAY['admin'::public.app_role,'admin_org'::public.app_role,
             'operador'::public.app_role,'contador'::public.app_role,
             'super_admin'::public.app_role]) THEN
    RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: tu rol no puede refacturar proformas'
      USING ERRCODE = '42501';
  END IF;
  IF v_old.deleted_at IS NOT NULL OR v_old.estado_proforma = 'cancelada' THEN
    RAISE EXCEPTION 'LC_REFACTURAR_PROFORMA_CANCELADA: esta proforma ya está cancelada';
  END IF;
  IF v_old.es_consolidada OR v_old.embarque_id IS NULL THEN
    RAISE EXCEPTION 'LC_REFACTURAR_CONSOLIDADA: las proformas consolidadas no se pueden refacturar desde aquí';
  END IF;
  -- Ninguna factura ligada puede seguir viva.
  SELECT EXISTS (
    SELECT 1 FROM public.facturas fa
     WHERE fa.deleted_at IS NULL
       AND (fa.proforma_id = p_proforma_id OR fa.id IN (v_old.factura_id, v_old.factura_secundaria_id))
       AND fa.estado::text NOT IN ('Cancelada','Sustituida')
  ) INTO v_viva;
  IF v_viva THEN
    RAISE EXCEPTION 'LC_PROFORMA_FACTURADA';
  END IF;
  SELECT fa.numero INTO v_factura_num FROM public.facturas fa
   WHERE fa.deleted_at IS NULL
     AND (fa.proforma_id = p_proforma_id OR fa.id IN (v_old.factura_id, v_old.factura_secundaria_id))
     AND fa.estado::text = 'Cancelada'
   ORDER BY fa.created_at DESC LIMIT 1;
  IF v_factura_num IS NULL THEN
    RAISE EXCEPTION 'LC_REFACTURAR_SIN_FACTURA_CANCELADA: sólo se refactura una proforma cuya factura fue cancelada';
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_conceptos
    FROM public.conceptos_venta
   WHERE proforma_id = p_proforma_id AND deleted_at IS NULL;
  IF v_conceptos IS NULL THEN
    RAISE EXCEPTION 'LC_REFACTURAR_SIN_CONCEPTOS: la proforma no tiene conceptos para copiar';
  END IF;
  -- Cierra la proforma histórica y libera sus conceptos.
  UPDATE public.conceptos_venta
     SET estado_facturacion = 'pendiente', proforma_id = NULL
   WHERE proforma_id = p_proforma_id;
  UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = p_proforma_id;
  -- La nueva proforma reutiliza todas las validaciones de alta y nace en borrador.
  SELECT * INTO v_new FROM public.crear_proforma_atomica(
    v_old.organization_id, v_old.embarque_id, v_old.cliente_id, v_old.cliente_nombre,
    v_old.expediente, v_old.bl_master, v_conceptos,
    v_old.subtotal_usd, v_old.iva_usd, v_old.total_usd,
    v_old.subtotal_mxn, v_old.iva_mxn, v_old.total_mxn,
    trim(both from concat_ws(E'\n',
      '[Refacturación de proforma ' || v_old.numero || ' / Factura ' || v_factura_num || ' cancelada]',
      v_old.notas)),
    v_old.operador, v_old.dias_credito, v_old.tasa_iva_aplicada, '{}'::jsonb);
  RETURN jsonb_build_object('nueva_proforma_id', v_new.id, 'nuevo_numero', v_new.numero,
                            'anterior_numero', v_old.numero, 'factura_cancelada', v_factura_num);
END;
$function$;

REVOKE ALL ON FUNCTION public.refacturar_proforma_rpc(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refacturar_proforma_rpc(uuid) TO authenticated, service_role;