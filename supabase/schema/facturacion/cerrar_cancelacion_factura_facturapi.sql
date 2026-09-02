-- Fuente canónica. Cierre idempotente compartido por facturapi-webhook (async)
-- y facturapi-cancelar (síncrono) cuando FacturApi/SAT acepta una cancelación.
-- Antes cada camino repetía (o, en el webhook, omitía) el cierre: estado
-- Cancelada/Sustituida + desactivar factura_embarques + liberar proforma.
-- Migración canónica: 20260908001000_cerrar_cancelacion_factura_facturapi.sql

CREATE OR REPLACE FUNCTION public.cerrar_cancelacion_factura_facturapi(
  p_factura_id uuid,
  p_sustituida_por_factura_id uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_estado_actual public.estado_factura;
  v_cancellation_status_actual text;
  v_sustituida_por uuid;
  v_estado_final public.estado_factura;
  v_now timestamptz := now();
  v_ya_cerrada boolean;
BEGIN
  IF p_factura_id IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_REQUERIDA: falta el identificador de la factura' USING ERRCODE = '22023';
  END IF;

  SELECT organization_id, estado, cancellation_status, sustituida_por
    INTO v_org, v_estado_actual, v_cancellation_status_actual, v_sustituida_por
    FROM public.facturas
   WHERE id = p_factura_id
   FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_NO_EXISTE: la factura no existe' USING ERRCODE = 'P0002';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'LC_NO_AUTORIZADO: sesión requerida' USING ERRCODE = '42501';
    END IF;
    IF public.is_org_member(v_org) IS NOT TRUE THEN
      RAISE EXCEPTION 'LC_ORG_FORBIDDEN: la factura pertenece a otra organización' USING ERRCODE = '42501';
    END IF;
    IF public.has_role(v_uid, 'super_admin'::public.app_role) IS NOT TRUE
       AND public.has_any_role_in_org(v_uid, ARRAY['admin','admin_org','contador']::public.app_role[], v_org) IS NOT TRUE THEN
      RAISE EXCEPTION 'LC_ROL_INSUFICIENTE: necesitas un rol fiscal para cerrar la cancelación' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_ya_cerrada := v_estado_actual IN ('Cancelada'::public.estado_factura, 'Sustituida'::public.estado_factura)
    AND v_cancellation_status_actual = 'accepted';

  v_sustituida_por := COALESCE(p_sustituida_por_factura_id, v_sustituida_por);
  v_estado_final := CASE WHEN v_sustituida_por IS NOT NULL
    THEN 'Sustituida'::public.estado_factura
    ELSE 'Cancelada'::public.estado_factura END;

  UPDATE public.facturas
     SET estado = v_estado_final,
         cancellation_status = 'accepted',
         cancelacion_motivo = COALESCE(p_motivo, cancelacion_motivo),
         cancelado_en = COALESCE(cancelado_en, v_now),
         cancelacion_solicitada_en = COALESCE(cancelacion_solicitada_en, v_now),
         sustituida_por = v_sustituida_por
   WHERE id = p_factura_id;

  UPDATE public.factura_embarques
     SET activa = false
   WHERE factura_id = p_factura_id AND activa = true;

  -- Compatibilidad legacy: sólo para cancelación pura (NO sustitución), igual
  -- que el camino síncrono anterior (revertirProformasCancelacion).
  IF v_estado_final = 'Cancelada'::public.estado_factura THEN
    UPDATE public.proformas
       SET factura_id = CASE WHEN factura_id = p_factura_id THEN NULL ELSE factura_id END,
           factura_secundaria_id = CASE WHEN factura_secundaria_id = p_factura_id THEN NULL ELSE factura_secundaria_id END
     WHERE factura_id = p_factura_id OR factura_secundaria_id = p_factura_id;
  END IF;

  -- Libera/revierte la proforma si ya no quedan facturas vivas apuntando a ella.
  PERFORM public.revertir_proforma_al_cancelar_sustitucion(p_factura_id);

  RETURN jsonb_build_object(
    'factura_id', p_factura_id,
    'estado', v_estado_final::text,
    'sustituida_por_factura_id', v_sustituida_por,
    'ya_cerrada', v_ya_cerrada
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cerrar_cancelacion_factura_facturapi(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cerrar_cancelacion_factura_facturapi(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cerrar_cancelacion_factura_facturapi(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_cancelacion_factura_facturapi(uuid, uuid, text) TO service_role;
