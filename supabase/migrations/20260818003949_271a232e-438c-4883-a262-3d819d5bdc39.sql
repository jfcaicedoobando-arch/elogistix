-- ============================================================
-- Etapa 3 · BUG-06: cancelar CxP exige rol financiero
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancelar_factura_proveedor(p_factura_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado public.estado_proveedor_factura;
  v_deleted timestamptz;
  v_org uuid;
  v_pagado numeric;
  v_ncs_canceladas int;
  v_uid uuid := auth.uid();
  v_desvinculo jsonb := '{}'::jsonb;
  v_ent uuid[];
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debes indicar un motivo de cancelación.' USING ERRCODE = '22023';
  END IF;

  SELECT estado, deleted_at, organization_id
    INTO v_estado, v_deleted, v_org
  FROM public.proveedor_facturas
  WHERE id = p_factura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'La factura está en la papelera; restáurala antes de cancelarla.' USING ERRCODE = '22023';
  END IF;
  IF v_estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'La factura ya está cancelada.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_org_member(v_org)
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar esta factura.' USING ERRCODE = '42501';
  END IF;

  -- BUG-06 (auditoría 2026-08-18): cancelar una CxP es un acto contable; sólo
  -- perfiles financieros. Antes bastaba ser miembro de la organización.
  IF NOT (public.has_role(v_uid, 'admin'::app_role)
          OR public.has_role(v_uid, 'super_admin'::app_role)
          OR public.has_role(v_uid, 'admin_org'::app_role)
          OR public.has_role(v_uid, 'contador'::app_role)
          OR public.has_role(v_uid, 'auxiliar_contable'::app_role)
          OR public.has_role(v_uid, 'tesorero'::app_role)) THEN
    RAISE EXCEPTION 'LC_CXP_CANCELAR_FORBIDDEN: tu rol no puede cancelar facturas de proveedor.'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
  FROM public.pagos_proveedor
  WHERE proveedor_factura_id = p_factura_id AND deleted_at IS NULL;

  IF v_pagado > 0 THEN
    RAISE EXCEPTION 'No puedes cancelar la factura: tiene pagos aplicados por %. Elimina o anula los pagos primero.', v_pagado
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.proveedor_notas_credito
     SET estado = 'Cancelada'::public.estado_nota_credito_proveedor,
         updated_at = now()
   WHERE proveedor_factura_id = p_factura_id
     AND deleted_at IS NULL
     AND estado <> 'Cancelada'::public.estado_nota_credito_proveedor;
  GET DIAGNOSTICS v_ncs_canceladas = ROW_COUNT;

  SELECT array_agg(id) INTO v_ent
  FROM public.embarque_facturas_entrantes
  WHERE proveedor_factura_id = p_factura_id AND deleted_at IS NULL;

  PERFORM set_config('app.cancelando_cxp','1', true);

  UPDATE public.proveedor_facturas
     SET estado = 'Cancelada'::public.estado_proveedor_factura,
         fecha_cancelacion = now(),
         motivo_cancelacion = btrim(p_motivo),
         cancelada_por = v_uid,
         estado_aprobacion = 'pendiente'::public.estado_aprobacion_factura_proveedor,
         updated_at = now()
   WHERE id = p_factura_id;

  PERFORM set_config('app.cancelando_cxp','0', true);

  v_desvinculo := public._cxp_desvincular_por_rechazo(p_factura_id, btrim(p_motivo));

  IF v_ent IS NOT NULL THEN
    UPDATE public.embarque_facturas_entrantes
       SET estado = 'rechazada',
           rechazo_motivo = btrim(p_motivo),
           proveedor_factura_id = NULL,
           capturado_por = NULL,
           updated_at = now()
     WHERE id = ANY(v_ent)
       AND deleted_at IS NULL;
  END IF;

  IF to_regclass('public.bitacora_actividad') IS NOT NULL THEN
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES
      (v_org, v_uid, 'cxp.cancelada', 'compras', p_factura_id, NULL,
       jsonb_build_object('motivo', btrim(p_motivo), 'ncs_canceladas', v_ncs_canceladas) || v_desvinculo);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancelar_factura_proveedor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_factura_proveedor(uuid, text) TO authenticated, service_role;

-- ============================================================
-- Etapa 3 · BUG-09: un embarque Cerrado no se cancela directo
-- ============================================================
CREATE OR REPLACE FUNCTION public.transicion_embarque_valida(p_actual estado_embarque, p_nuevo estado_embarque)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_actual = p_nuevo THEN RETURN true; END IF;

  -- BUG-09 (auditoría 2026-08-18): la regla blanket de cancelación se evaluaba
  -- antes del CASE y permitía 'Cerrado' -> 'Cancelado' con comisiones
  -- definitivas y CxC/CxP liquidadas. Un embarque cerrado debe reabrirse
  -- primero ('Por liquidar' o 'EIR') y cancelarse desde ahí.
  IF p_nuevo = 'Cancelado' AND p_actual NOT IN ('Cancelado', 'Cerrado') THEN
    RETURN true;
  END IF;

  RETURN CASE p_actual
    WHEN 'Borrador'     THEN p_nuevo IN ('Confirmado')
    WHEN 'Cotización'   THEN p_nuevo IN ('Confirmado','Borrador')
    WHEN 'Confirmado'   THEN p_nuevo IN ('En Tránsito','Borrador')
    WHEN 'En Tránsito'  THEN p_nuevo IN ('Arribo','En Proceso')
    WHEN 'Arribo'       THEN p_nuevo IN ('En Aduana','En Tránsito')
    WHEN 'En Aduana'    THEN p_nuevo IN ('Entregado','Arribo')
    WHEN 'Llegada'      THEN p_nuevo IN ('Arribo','En Aduana')
    WHEN 'Entregado'    THEN p_nuevo IN ('EIR','En Aduana','Cerrado')
    WHEN 'EIR'          THEN p_nuevo IN ('Por liquidar','Cerrado','Entregado')
    WHEN 'Por liquidar' THEN p_nuevo IN ('Cerrado','EIR')
    WHEN 'Cerrado'      THEN p_nuevo IN ('Por liquidar','EIR')
    WHEN 'En Proceso'   THEN p_nuevo IN ('En Tránsito','Arribo','En Aduana')
    WHEN 'Cancelado'    THEN false
    ELSE false
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.transicion_embarque_valida(estado_embarque, estado_embarque) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transicion_embarque_valida(estado_embarque, estado_embarque) TO authenticated, service_role;