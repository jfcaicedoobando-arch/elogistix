-- Ola E1 · N21 — Re-emisión canónica de public.eliminar_pago_proveedor.
-- La condición muerta del CTE `baja` (`OR pago_proveedor_id = _pago_id` anulada
-- por un AND posterior) se eliminó. Se re-emite con timestamp posterior a
-- 20260830000100 para que el replay en base limpia deje la versión vigente.

CREATE OR REPLACE FUNCTION public.eliminar_pago_proveedor(_pago_id uuid, _motivo text DEFAULT NULL::text)
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
  v_anticipos int := 0;
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
      'movimientos_baja', 0, 'movimientos_desvinculados', 0, 'costos_recalculados', 0,
      'anticipos_revertidos', 0
    );
  END IF;

  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND v_pago.organization_id IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: el pago pertenece a otra organizacion'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_any_role_in_org_exact(v_uid,
       ARRAY['super_admin','admin','admin_org','contador','tesorero','ejecutivo_cobranza']::public.app_role[],
       v_pago.organization_id) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO: tu rol no puede eliminar pagos'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.pagos_proveedor
     SET deleted_at = now(), deleted_by = v_uid
   WHERE id = _pago_id AND deleted_at IS NULL;

  WITH rev AS (
    UPDATE public.anticipos_aplicaciones
       SET deleted_at = now(), deleted_by = v_uid, updated_at = now()
     WHERE pago_proveedor_id = _pago_id
       AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_anticipos FROM rev;

  -- Ola E1 · N21: sólo los movimientos GENERADOS por el pago (hash_dedupe) se
  -- dan de baja; los movimientos bancarios reales del estado de cuenta se
  -- desvinculan más abajo (nunca se borran).
  WITH baja AS (
    UPDATE public.bbva_movimientos
       SET deleted_at = now(), deleted_by = v_uid
     WHERE deleted_at IS NULL
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
      'anticipos_revertidos', v_anticipos,
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
    'costos_recalculados', v_costos,
    'anticipos_revertidos', v_anticipos
  );
END;
$function$;

-- H6 · higiene de permisos (idéntica a 20260830000100).
REVOKE ALL ON FUNCTION public.eliminar_pago_proveedor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_pago_proveedor(uuid, text) TO authenticated, service_role;
