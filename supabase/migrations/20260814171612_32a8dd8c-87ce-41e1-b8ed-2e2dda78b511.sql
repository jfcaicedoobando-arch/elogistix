-- Ola 15 · Eliminacion de pagos con garantia transaccional.
-- Antes: el cliente hacia 3 llamadas (soft-delete del pago, baja del movimiento
-- bancario, bitacora). Si la 2a fallaba, el banco quedaba descuadrado.

CREATE OR REPLACE FUNCTION public.eliminar_pago_cliente(_pago_id uuid, _motivo text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pago record;
  v_baja int := 0;
  v_desvinculados int := 0;
BEGIN
  SELECT id, factura_id, organization_id, deleted_at, uuid_rep, rep_cancelado_en, monto, moneda
    INTO v_pago
  FROM public.pagos_factura
  WHERE id = _pago_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO: el pago % no existe', _pago_id USING ERRCODE = 'P0002';
  END IF;

  IF v_pago.deleted_at IS NOT NULL THEN
    -- Idempotente: no se vuelve a tocar el banco ni la bitacora.
    RETURN jsonb_build_object(
      'pago_id', _pago_id, 'ya_eliminado', true,
      'movimientos_baja', 0, 'movimientos_desvinculados', 0
    );
  END IF;

  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND v_pago.organization_id IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: el pago pertenece a otra organizacion'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.es_escritor_financiero(v_uid) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO: tu rol no puede eliminar pagos'
      USING ERRCODE = '42501';
  END IF;

  IF v_pago.uuid_rep IS NOT NULL AND v_pago.rep_cancelado_en IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_CON_REP_VIVO: cancela el complemento de pago (REP) antes de eliminar el pago'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.pagos_factura
     SET deleted_at = now(), deleted_by = v_uid
   WHERE id = _pago_id AND deleted_at IS NULL;

  -- 1) Movimiento generado por el sistema: se da de baja con el pago.
  WITH baja AS (
    UPDATE public.bbva_movimientos
       SET deleted_at = now(), deleted_by = v_uid
     WHERE pago_factura_id = _pago_id
       AND deleted_at IS NULL
       AND hash_dedupe = 'cobro-' || _pago_id::text
    RETURNING 1
  )
  SELECT count(*) INTO v_baja FROM baja;

  -- 2) Movimiento importado del estado de cuenta: se conserva y se desvincula.
  WITH libre AS (
    UPDATE public.bbva_movimientos
       SET pago_factura_id = NULL,
           estado_conciliacion = 'Pendiente'::estado_conciliacion,
           conciliado_por = NULL,
           conciliado_at = NULL
     WHERE pago_factura_id = _pago_id
       AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_desvinculados FROM libre;

  INSERT INTO public.bitacora_actividad
    (usuario_id, usuario_email, accion, modulo, entidad_id, detalles, organization_id)
  VALUES (
    COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE((SELECT u.email FROM auth.users u WHERE u.id = v_uid), 'sistema'),
    'eliminar_pago', 'facturacion', v_pago.factura_id,
    jsonb_build_object(
      'pago_id', _pago_id,
      'monto', v_pago.monto,
      'moneda', v_pago.moneda,
      'motivo', _motivo,
      'movimientos_baja', v_baja,
      'movimientos_desvinculados', v_desvinculados,
      'atomico', true
    ),
    v_pago.organization_id
  );

  RETURN jsonb_build_object(
    'pago_id', _pago_id,
    'factura_id', v_pago.factura_id,
    'ya_eliminado', false,
    'movimientos_baja', v_baja,
    'movimientos_desvinculados', v_desvinculados
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.eliminar_pago_cliente(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_pago_cliente(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.eliminar_pago_cliente(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_pago_cliente(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.eliminar_pago_proveedor(_pago_id uuid, _motivo text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pago record;
  v_baja int := 0;
  v_desvinculados int := 0;
  v_costos int := 0;
BEGIN
  SELECT id, proveedor_factura_id, organization_id, deleted_at, monto, moneda
    INTO v_pago
  FROM public.pagos_proveedor
  WHERE id = _pago_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO: el pago % no existe', _pago_id USING ERRCODE = 'P0002';
  END IF;

  IF v_pago.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'pago_id', _pago_id, 'ya_eliminado', true,
      'movimientos_baja', 0, 'movimientos_desvinculados', 0, 'costos_recalculados', 0
    );
  END IF;

  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND v_pago.organization_id IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: el pago pertenece a otra organizacion'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.es_escritor_financiero(v_uid) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO: tu rol no puede eliminar pagos'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.pagos_proveedor
     SET deleted_at = now(), deleted_by = v_uid
   WHERE id = _pago_id AND deleted_at IS NULL;

  WITH baja AS (
    UPDATE public.bbva_movimientos
       SET deleted_at = now(), deleted_by = v_uid
     WHERE deleted_at IS NULL
       AND (pago_proveedor_id = _pago_id OR hash_dedupe = 'pago-' || _pago_id::text)
       AND hash_dedupe = 'pago-' || _pago_id::text
    RETURNING 1
  )
  SELECT count(*) INTO v_baja FROM baja;

  WITH libre AS (
    UPDATE public.bbva_movimientos
       SET pago_proveedor_id = NULL,
           estado_conciliacion = 'Pendiente'::estado_conciliacion,
           conciliado_por = NULL,
           conciliado_at = NULL
     WHERE pago_proveedor_id = _pago_id
       AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_desvinculados FROM libre;

  -- El recalculo de `conceptos_costo.estado_liquidacion` lo hace el trigger
  -- `trg_pagos_proveedor_recalc_liq` dentro de esta misma transaccion; aqui
  -- solo se informa cuantas lineas de costo quedaron ligadas a la factura.
  SELECT count(DISTINCT pfc.concepto_costo_id) INTO v_costos
  FROM public.proveedor_facturas_conceptos pfc
  WHERE pfc.proveedor_factura_id = v_pago.proveedor_factura_id
    AND pfc.concepto_costo_id IS NOT NULL;

  INSERT INTO public.bitacora_actividad
    (usuario_id, usuario_email, accion, modulo, entidad_id, detalles, organization_id)
  VALUES (
    COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE((SELECT u.email FROM auth.users u WHERE u.id = v_uid), 'sistema'),
    'eliminar_pago', 'cxp', v_pago.proveedor_factura_id,
    jsonb_build_object(
      'pago_id', _pago_id,
      'monto', v_pago.monto,
      'moneda', v_pago.moneda,
      'motivo', _motivo,
      'movimientos_baja', v_baja,
      'movimientos_desvinculados', v_desvinculados,
      'costos_recalculados', v_costos,
      'atomico', true
    ),
    v_pago.organization_id
  );

  RETURN jsonb_build_object(
    'pago_id', _pago_id,
    'proveedor_factura_id', v_pago.proveedor_factura_id,
    'ya_eliminado', false,
    'movimientos_baja', v_baja,
    'movimientos_desvinculados', v_desvinculados,
    'costos_recalculados', v_costos
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.eliminar_pago_proveedor(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_pago_proveedor(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.eliminar_pago_proveedor(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_pago_proveedor(uuid, text) TO service_role;