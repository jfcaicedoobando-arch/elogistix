CREATE OR REPLACE FUNCTION public.eliminar_proforma_rpc(p_proforma_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org uuid; v_numero text; v_estado text; v_factura uuid; v_factura2 uuid;
  v_deleted timestamptz; v_embarque uuid; v_factura_viva boolean;
BEGIN
  SELECT organization_id, numero, estado_proforma, factura_id,
         factura_secundaria_id, deleted_at, embarque_id
    INTO v_org, v_numero, v_estado, v_factura, v_factura2, v_deleted, v_embarque
  FROM public.proformas WHERE id = p_proforma_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.has_any_role_efectivo(
       auth.uid(),
       ARRAY['admin'::public.app_role, 'admin_org'::public.app_role,
             'operador'::public.app_role, 'contador'::public.app_role,
             'super_admin'::public.app_role]
     ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: tu rol no puede cancelar proformas'
      USING ERRCODE = '42501';
  END IF;
  IF v_deleted IS NOT NULL OR v_estado = 'cancelada' THEN
    RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque,
                              'eliminada', false, 'cancelada', false);
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.facturas fa
     WHERE fa.id IN (v_factura, v_factura2)
       AND fa.deleted_at IS NULL
       AND fa.estado::text NOT IN ('Cancelada', 'Sustituida')
  ) INTO v_factura_viva;
  IF v_factura_viva OR lower(COALESCE(v_estado, '')) = 'facturada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_FACTURADA';
  END IF;
  -- Se conserva la proforma (histórico) y se liberan sus conceptos.
  UPDATE public.conceptos_venta
     SET estado_facturacion = 'pendiente', proforma_id = NULL
   WHERE proforma_id = p_proforma_id;
  UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = p_proforma_id;
  RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque,
                            'eliminada', false, 'cancelada', true);
END;
$$;
REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO authenticated, service_role;