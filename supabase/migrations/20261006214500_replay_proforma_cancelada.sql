-- Replay de drizzle/migrations/0008 y 0009 (ya aplicadas en Lovable Cloud): proformas canceladas conservan histórico.
-- Proformas: estado 'cancelada' conserva el histórico y libera los conceptos.
ALTER TABLE public.proformas DROP CONSTRAINT proformas_estado_proforma_check;
ALTER TABLE public.proformas ADD CONSTRAINT proformas_estado_proforma_check
  CHECK (estado_proforma = ANY (ARRAY['pendiente'::text, 'facturada'::text, 'cancelada'::text]));

CREATE OR REPLACE FUNCTION public.recompute_embarque_tiene_proforma(p_embarque_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_embarque_id IS NULL THEN
    RETURN;
  END IF;
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.embarques e
  SET tiene_proforma = EXISTS (
    SELECT 1
    FROM public.proformas p
    WHERE p.embarque_id = e.id
      AND p.deleted_at IS NULL
      AND COALESCE(p.estado_proforma, 'pendiente') <> 'cancelada'
      AND (
        COALESCE(p.estado_aprobacion, 'aprobada') <> 'borrador'
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id
        )
      )
  )
  WHERE e.id = p_embarque_id;
END;
$$;

-- Borradores se siguen eliminando; proformas aprobadas se cancelan (histórico).
CREATE OR REPLACE FUNCTION public.eliminar_proforma_rpc(p_proforma_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org uuid;
  v_numero text;
  v_estado text;
  v_aprobacion text;
  v_factura uuid;
  v_factura2 uuid;
  v_deleted timestamptz;
  v_embarque uuid;
  v_factura_viva boolean;
BEGIN
  SELECT organization_id, numero, estado_proforma, estado_aprobacion, factura_id,
         factura_secundaria_id, deleted_at, embarque_id
    INTO v_org, v_numero, v_estado, v_aprobacion, v_factura, v_factura2, v_deleted, v_embarque
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
    RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: tu rol no puede eliminar proformas'
      USING ERRCODE = '42501';
  END IF;
  IF v_deleted IS NOT NULL OR v_estado = 'cancelada' THEN
    RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque,
                              'eliminada', false, 'cancelada', v_estado = 'cancelada');
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
  UPDATE public.conceptos_venta
     SET estado_facturacion = 'pendiente', proforma_id = NULL
   WHERE proforma_id = p_proforma_id;
  IF COALESCE(v_aprobacion, 'aprobada') = 'borrador' THEN
    UPDATE public.proformas
       SET deleted_at = now(), deleted_by = auth.uid()
     WHERE id = p_proforma_id;
    RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque,
                              'eliminada', true, 'cancelada', false);
  END IF;
  UPDATE public.proformas
     SET estado_proforma = 'cancelada'
   WHERE id = p_proforma_id;
  RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque,
                            'eliminada', false, 'cancelada', true);
END;
$$;
REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO authenticated, service_role;
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