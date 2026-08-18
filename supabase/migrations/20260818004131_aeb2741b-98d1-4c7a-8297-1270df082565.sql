-- Restaura la versión canónica de BL-03 (sin el guard inline): el permiso ahora
-- vive en un trigger para que sea independiente del orden de migraciones.
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

  IF NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar esta factura.' USING ERRCODE = '42501';
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

  -- v13.508.2 — capturamos los documentos del buzón ANTES de cancelar: el
  -- trigger _reabrir_entrantes_factura los devuelve a "por_capturar" y borra
  -- el vínculo, así que después ya no se pueden ubicar por factura.
  SELECT array_agg(id) INTO v_ent
  FROM public.embarque_facturas_entrantes
  WHERE proveedor_factura_id = p_factura_id AND deleted_at IS NULL;

  -- Marca de sesión para permitir la transición a Cancelada.
  PERFORM set_config('app.cancelando_cxp','1', true);

  UPDATE public.proveedor_facturas
     SET estado = 'Cancelada'::public.estado_proveedor_factura,
         fecha_cancelacion = now(),
         motivo_cancelacion = btrim(p_motivo),
         cancelada_por = v_uid,
         -- BL-03: una factura cancelada no puede conservar la aprobación;
         -- sin este reset quedaba 'aprobada' y admitía pagos/anticipos en
         -- cualquier path que sólo valide estado_aprobacion.
         estado_aprobacion = 'pendiente'::public.estado_aprobacion_factura_proveedor,
         updated_at = now()
   WHERE id = p_factura_id;

  PERFORM set_config('app.cancelando_cxp','0', true);

  -- v13.505.0 — cancelar también desvincula: los conceptos de costo del
  -- embarque vuelven a "sin factura" y el expediente se suelta.
  v_desvinculo := public._cxp_desvincular_por_rechazo(p_factura_id, btrim(p_motivo));

  -- El documento del buzón queda Rechazado (no "por capturar") y sin vínculo.
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

-- BUG-06 (auditoría 2026-08-18): el permiso vive en la tabla, no en la RPC.
CREATE OR REPLACE FUNCTION public.guard_cxp_cancelacion_rol_financiero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  IF NEW.estado <> 'Cancelada'::public.estado_proveedor_factura THEN RETURN NEW; END IF;
  -- Procesos del sistema (crons, edge functions) siguen operando.
  IF v_uid IS NULL OR auth.role() = 'service_role' THEN RETURN NEW; END IF;

  IF NOT (public.has_role(v_uid, 'admin'::app_role)
          OR public.has_role(v_uid, 'super_admin'::app_role)
          OR public.has_role(v_uid, 'admin_org'::app_role)
          OR public.has_role(v_uid, 'contador'::app_role)
          OR public.has_role(v_uid, 'auxiliar_contable'::app_role)
          OR public.has_role(v_uid, 'tesorero'::app_role)) THEN
    RAISE EXCEPTION 'LC_CXP_CANCELAR_FORBIDDEN: tu rol no puede cancelar facturas de proveedor.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_cxp_cancelacion_rol_financiero() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_cxp_cancelacion_rol_financiero() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_cxp_cancelacion_rol_financiero ON public.proveedor_facturas;
CREATE TRIGGER trg_cxp_cancelacion_rol_financiero
  BEFORE UPDATE OF estado ON public.proveedor_facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_cxp_cancelacion_rol_financiero();